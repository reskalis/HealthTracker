const MODEL_ID = "tiny.en";
const MODEL_CACHE_KEY = "tiny.en-full-v1";
const MODEL_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin";
const MODEL_DB = "HealthTrackerWhisperUpstream";
const MODEL_STORE = "models";
const MODEL_FILE = "whisper.bin";
const SAMPLE_RATE = 16000;
const RUNTIME_URL = new URL("../../vendor/whisper-upstream/main.js", import.meta.url).href;

export const VOICE_MODEL_SIZE_MB = 77;
export const VOICE_MODEL_NAME = "Whisper tiny.en";

let runtimePromise = null;
let moduleRef = null;
let instance = null;
let preparing = null;
let activeTranscription = null;
let recentRuntimeLines = [];

function rememberRuntimeLine(line) {
  const text = String(line ?? "").trim();
  if (!text) return;
  recentRuntimeLines.push(text);
  if (recentRuntimeLines.length > 80) recentRuntimeLines.shift();
}

function timestampToMs(value) {
  const match = String(value).match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
  if (!match) return 0;
  const [, hours, minutes, seconds] = match;
  return Math.round(
    (Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000
  );
}

function handleRuntimeLine(rawLine, isError = false) {
  const line = String(rawLine ?? "");
  rememberRuntimeLine(line);

  const job = activeTranscription;
  if (!job) return;

  const segmentMatch = line.match(
    /^\s*\[?\s*(\d+:\d+:\d+(?:\.\d+)?)\s*-->\s*(\d+:\d+:\d+(?:\.\d+)?)\s*\]?\s*(.*)$/
  );

  if (segmentMatch) {
    const segment = {
      timeStart: timestampToMs(segmentMatch[1]),
      timeEnd: timestampToMs(segmentMatch[2]),
      text: segmentMatch[3].trim()
    };

    if (segment.text) {
      job.segments.push(segment);
      job.onSegment?.(segment);
    }
    return;
  }

  if (/whisper_print_timings:\s+total time\s*=/.test(line)) {
    job.finish();
    return;
  }

  if (
    isError &&
    (/Aborted/i.test(line) || /failed to initialize whisper/i.test(line))
  ) {
    job.fail(new Error(line.trim() || "Whisper runtime failed."));
  }
}

function openModelDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MODEL_DB, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MODEL_STORE)) {
        db.createObjectStore(MODEL_STORE, { keyPath: "id" });
      }
    };
  });
}

async function getCachedModel() {
  const db = await openModelDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction(MODEL_STORE, "readonly")
        .objectStore(MODEL_STORE)
        .get(MODEL_CACHE_KEY);

      request.onsuccess = () => resolve(request.result?.data ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function cacheModel(data) {
  const db = await openModelDb();
  try {
    await new Promise((resolve, reject) => {
      const request = db
        .transaction(MODEL_STORE, "readwrite")
        .objectStore(MODEL_STORE)
        .put({
          id: MODEL_CACHE_KEY,
          data,
          bytes: data.byteLength,
          cachedAt: new Date().toISOString()
        });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function downloadModel(onProgress) {
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    throw new Error("Could not download the local Whisper model.");
  }

  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body?.getReader();

  if (!reader) {
    const data = new Uint8Array(await response.arrayBuffer());
    onProgress(100, "Model downloaded.");
    return data;
  }

  const chunks = [];
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      chunks.push(value);
      received += value.byteLength;

      if (total > 0) {
        const progress = Math.min(100, Math.round((received / total) * 100));
        onProgress(progress, `Downloading local voice model… ${progress}%`);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const data = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }

  onProgress(100, "Model downloaded.");
  return data;
}

function installRuntimeScript() {
  if (runtimePromise) return runtimePromise;

  runtimePromise = new Promise((resolve, reject) => {
    if (!globalThis.crossOriginIsolated) {
      reject(
        new Error(
          "Local Whisper needs the updated browser security context. Reload HealthTracker and try again."
        )
      );
      return;
    }

    const Module = {
      noInitialRun: true,
      locateFile(path) {
        return new URL(path, RUNTIME_URL).href;
      },
      print(line) {
        handleRuntimeLine(line, false);
      },
      printErr(line) {
        handleRuntimeLine(line, true);
      },
      setStatus() {},
      monitorRunDependencies() {},
      onRuntimeInitialized() {
        moduleRef = globalThis.Module;
        resolve(moduleRef);
      }
    };

    globalThis.Module = Module;

    const script = document.createElement("script");
    script.src = RUNTIME_URL;
    script.async = true;
    script.dataset.healthtrackerWhisperRuntime = "upstream";
    script.onerror = () => reject(new Error("Could not load the local Whisper runtime."));
    document.head.appendChild(script);
  });

  return runtimePromise;
}

function storeModelInRuntime(Module, modelData) {
  try {
    Module.FS_unlink(MODEL_FILE);
  } catch {
    // The model file does not exist yet.
  }

  Module.FS_createDataFile("/", MODEL_FILE, modelData, true, true);
}

function initializeModel(Module) {
  if (instance) return instance;

  instance = Module.init(MODEL_FILE);
  if (!instance) {
    throw new Error("Whisper could not initialize the local model.");
  }

  return instance;
}

async function decodeAudio(blob) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  const OfflineAudioContextClass =
    globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;

  if (!AudioContextClass || !OfflineAudioContextClass) {
    throw new Error("This browser cannot prepare audio for local transcription.");
  }

  const context = new AudioContextClass();
  try {
    const encoded = await blob.arrayBuffer();
    const decoded = await context.decodeAudioData(encoded.slice(0));

    const frameCount = Math.max(1, Math.ceil(decoded.duration * SAMPLE_RATE));
    const offline = new OfflineAudioContextClass(1, frameCount, SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);

    const rendered = await offline.startRendering();
    const audio = new Float32Array(rendered.getChannelData(0));

    // Safari's MediaRecorder -> decodeAudioData path can yield a much quieter
    // waveform than the upstream whisper.cpp microphone demo. Normalize only
    // by a constant gain so we preserve the waveform while bringing speech
    // into the range Whisper expects. The previous HealthTracker decoder also
    // normalized recordings and produced healthy ~0.95 peaks on this iPhone.
    let peak = 0;
    for (const sample of audio) {
      const absolute = Math.abs(sample);
      if (absolute > peak) peak = absolute;
    }

    if (peak > 0 && peak < 0.95) {
      const gain = 0.95 / peak;
      for (let i = 0; i < audio.length; i++) {
        audio[i] = Math.max(-1, Math.min(1, audio[i] * gain));
      }
    }

    return audio;
  } finally {
    try {
      await context.close();
    } catch {
      // Closing is best effort.
    }
  }
}

function audioStats(audioData) {
  let peak = 0;
  let sumSquares = 0;

  for (const value of audioData) {
    const absolute = Math.abs(value);
    if (absolute > peak) peak = absolute;
    sumSquares += value * value;
  }

  return {
    samples: audioData.length,
    durationSeconds: audioData.length / SAMPLE_RATE,
    peak,
    rms: audioData.length ? Math.sqrt(sumSquares / audioData.length) : 0
  };
}

export async function voiceModelStatus() {
  try {
    const cached = await getCachedModel();
    return {
      id: MODEL_ID,
      installed: Boolean(cached?.byteLength),
      sizeMB: VOICE_MODEL_SIZE_MB,
      name: VOICE_MODEL_NAME
    };
  } catch {
    return {
      id: MODEL_ID,
      installed: false,
      sizeMB: VOICE_MODEL_SIZE_MB,
      name: VOICE_MODEL_NAME
    };
  }
}

export async function prepareVoiceModel(onProgress = () => {}) {
  if (instance && moduleRef) {
    onProgress(100, "Voice model ready.");
    return;
  }

  if (preparing) return preparing;

  preparing = (async () => {
    try {
      await navigator.storage?.persist?.();
    } catch {
      // Persistence is best effort.
    }

    onProgress(0, "Starting official Whisper runtime…");
    const Module = await installRuntimeScript();

    onProgress(0, "Checking local voice model…");
    let modelData = await getCachedModel();

    if (!modelData) {
      modelData = await downloadModel(onProgress);
      onProgress(100, "Saving model on this device…");
      await cacheModel(modelData);
    } else {
      onProgress(100, "Local model found.");
    }

    onProgress(100, "Loading model into Whisper…");
    storeModelInRuntime(Module, modelData);
    initializeModel(Module);
    onProgress(100, "Voice model ready.");
  })();

  try {
    await preparing;
  } finally {
    preparing = null;
  }
}

export async function transcribeVoiceAudio(blob, {
  onProgress = () => {}
} = {}) {
  await prepareVoiceModel(onProgress);

  if (activeTranscription) {
    throw new Error("A local transcription is already running.");
  }

  onProgress(100, "Preparing audio…");
  const audioData = await decodeAudio(blob);
  const threads = Math.max(
    1,
    Math.min(4, Number(navigator.hardwareConcurrency) || 4)
  );

  const diagnostics = {
    timestamp: new Date().toISOString(),
    engine: "official whisper.cpp whisper.wasm",
    model: MODEL_ID,
    crossOriginIsolated: Boolean(globalThis.crossOriginIsolated),
    userAgent: navigator.userAgent,
    hardwareConcurrency: Number(navigator.hardwareConcurrency) || null,
    blobType: blob.type || "unknown",
    blobBytes: blob.size,
    threads,
    threadMode: "upstream-pthreads",
    audio: audioStats(audioData)
  };

  onProgress(100, "Transcribing locally…");

  recentRuntimeLines = [];
  const startedAt = performance.now();

  const result = await new Promise((resolve, reject) => {
    const segments = [];
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      activeTranscription = null;
      reject(new Error("Local transcription timed out."));
    }, 120000);

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      activeTranscription = null;
      resolve({ segments });
    };

    const fail = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      activeTranscription = null;
      reject(error);
    };

    activeTranscription = {
      segments,
      onSegment(segment) {
        onProgress(100, "Transcribing locally…", segment);
      },
      finish,
      fail
    };

    const code = moduleRef.full_default(
      instance,
      audioData,
      "en",
      threads,
      false
    );

    if (code) {
      fail(new Error("Whisper returned error code " + code + "."));
    }
  });

  diagnostics.transcribeDurationMs = Math.round(performance.now() - startedAt);
  diagnostics.segmentCount = result.segments.length;
  diagnostics.segments = result.segments;
  diagnostics.runtimeTail = recentRuntimeLines.slice(-20);

  const transcript = result.segments
    .map(segment => segment.text)
    .filter(text => !/^\s*\[(?:BLANK_AUDIO|SILENCE)\]\s*$/i.test(text))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  onProgress(
    100,
    transcript ? "Transcription complete." : "No speech detected."
  );

  return { transcript, diagnostics };
}
