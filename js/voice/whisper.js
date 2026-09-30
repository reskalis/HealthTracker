const MODEL_ID = "base.en-q5_1";
export const VOICE_MODEL_SIZE_MB = 57;
export const VOICE_MODEL_NAME = "Whisper base.en Q5_1";

let runtimePromise = null;
let manager = null;
let modelReady = false;
let preparing = null;
let worker = null;
let workerReady = null;
let nextRequestId = 1;
const pendingWorkerRequests = new Map();

async function runtime() {
  if (!runtimePromise) {
    runtimePromise = import("../../vendor/whisper-wasm/index.es.js");
  }
  return runtimePromise;
}

async function objects() {
  if (manager) return { manager };

  const { ModelManager } = await runtime();
  manager = new ModelManager({ logLevel: 3 });
  return { manager };
}

function ensureWorker() {
  if (worker) return worker;

  worker = new Worker(
    new URL("./whisper-worker.js", import.meta.url),
    { type: "module" }
  );

  worker.addEventListener("message", event => {
    const message = event.data ?? {};
    const pending = pendingWorkerRequests.get(message.id);
    if (!pending) return;

    if (message.type === "segment") {
      pending.onSegment?.(message.segment);
      return;
    }

    if (message.type === "ready" || message.type === "result") {
      pendingWorkerRequests.delete(message.id);
      pending.resolve(message);
      return;
    }

    if (message.type === "error") {
      pendingWorkerRequests.delete(message.id);
      pending.reject(new Error(message.error || "Whisper worker failed."));
    }
  });

  worker.addEventListener("error", event => {
    const error = new Error(
      event?.message || "Whisper worker crashed."
    );
    for (const pending of pendingWorkerRequests.values()) {
      pending.reject(error);
    }
    pendingWorkerRequests.clear();
    worker?.terminate();
    worker = null;
    workerReady = null;
  });

  return worker;
}

function workerRequest(type, payload = {}, { onSegment } = {}) {
  const target = ensureWorker();
  const id = nextRequestId++;

  return new Promise((resolve, reject) => {
    pendingWorkerRequests.set(id, { resolve, reject, onSegment });

    if (payload.audioBuffer) {
      target.postMessage(
        { id, type, ...payload },
        [payload.audioBuffer]
      );
    } else {
      target.postMessage({ id, type, ...payload });
    }
  });
}

async function ensureWorkerReady() {
  if (!workerReady) {
    workerReady = workerRequest("init")
      .catch(error => {
        workerReady = null;
        throw error;
      });
  }
  await workerReady;
}

export async function voiceModelStatus() {
  const { manager } = await objects();
  const models = await manager.getAvailableModels();
  const model = models.find(item => item.id === MODEL_ID);
  return {
    id: MODEL_ID,
    installed: Boolean(model?.cached),
    sizeMB: VOICE_MODEL_SIZE_MB,
    name: VOICE_MODEL_NAME
  };
}

export async function prepareVoiceModel(onProgress = () => {}) {
  if (modelReady) {
    onProgress(100, "Voice model ready.");
    return;
  }
  if (preparing) return preparing;

  preparing = (async () => {
    const { manager } = await objects();

    try {
      await navigator.storage?.persist?.();
    } catch {
      // Persistence is a best-effort browser request. Model caching still works
      // without it and the model can always be downloaded again.
    }

    onProgress(0, "Loading local voice model…");
    await manager.loadModel(MODEL_ID, true, progress => {
      onProgress(progress, progress >= 100
        ? "Preparing Whisper…"
        : `Downloading local voice model… ${progress}%`);
    });

    // The model is cached here on the page, but initialized inside a dedicated
    // Worker so inference cannot freeze HealthTracker's UI.
    onProgress(100, "Starting local Whisper…");
    await ensureWorkerReady();

    modelReady = true;
    onProgress(100, "Voice model ready.");
  })();

  try {
    await preparing;
  } finally {
    preparing = null;
  }
}

function audioStats(audioData) {
  let peak = 0;
  let sumSquares = 0;

  for (let i = 0; i < audioData.length; i++) {
    const value = audioData[i];
    const abs = Math.abs(value);
    if (abs > peak) peak = abs;
    sumSquares += value * value;
  }

  const rms = audioData.length
    ? Math.sqrt(sumSquares / audioData.length)
    : 0;

  return {
    samples: audioData.length,
    durationSeconds: audioData.length / 16000,
    peak,
    rms
  };
}

export async function transcribeVoiceAudio(blob, {
  onProgress = () => {}
} = {}) {
  await prepareVoiceModel(onProgress);

  const { convertFromArrayBuffer } = await runtime();

  const diagnostics = {
    timestamp: new Date().toISOString(),
    crossOriginIsolated: Boolean(globalThis.crossOriginIsolated),
    userAgent: navigator.userAgent,
    hardwareConcurrency: Number(navigator.hardwareConcurrency) || null,
    blobType: blob.type || "unknown",
    blobBytes: blob.size
  };

  onProgress(100, "Preparing audio…");
  const buffer = await blob.arrayBuffer();
  const { audioData, audioInfo, warnings } = await convertFromArrayBuffer(buffer, {
    targetSampleRate: 16000,
    targetChannels: 1,
    normalize: true,
    noiseReduction: false,
    logLevel: "ERROR"
  });

  diagnostics.audioInfo = audioInfo ?? null;
  diagnostics.audioWarnings = warnings ?? [];
  diagnostics.audio = audioStats(audioData);

  // Diagnostic v0.9.1 build: force Whisper to one inference thread.
  // The iPhone Safari test captured healthy audio but the pthread worker
  // failed immediately. Keeping this global for the experiment makes the
  // comparison clean; we can restore adaptive threading after compatibility
  // is proven.
  const threads = 1;
  diagnostics.threads = threads;
  diagnostics.threadMode = "forced-single-thread";

  const runtimeWarnings = [];
  diagnostics.runtimeWarnings = runtimeWarnings;

  onProgress(100, "Transcribing locally…");

  // Hand the already-converted Float32 audio buffer to a dedicated worker.
  // The non-pthread WASM runtime stays single-threaded internally, while the
  // browser's UI thread remains responsive.
  const transferable = audioData.buffer.slice(
    audioData.byteOffset,
    audioData.byteOffset + audioData.byteLength
  );

  const response = await workerRequest(
    "transcribe",
    { audioBuffer: transferable },
    {
      onSegment: segment => {
        onProgress(100, "Transcribing locally…", segment);
      }
    }
  );

  const result = response.result ?? { segments: [] };

  diagnostics.segmentCount = result.segments?.length ?? 0;
  diagnostics.transcribeDurationMs = result.transcribeDurationMs ?? null;
  diagnostics.segments = (result.segments ?? []).map(segment => ({
    timeStart: segment.timeStart,
    timeEnd: segment.timeEnd,
    text: segment.text
  }));

  const transcript = (result?.segments ?? [])
    .map(segment => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  onProgress(100, transcript ? "Transcription complete." : "No speech detected.");
  return { transcript, diagnostics };
}
