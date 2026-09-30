const MODEL_ID = "base.en-q5_1";
export const VOICE_MODEL_SIZE_MB = 57;
export const VOICE_MODEL_NAME = "Whisper base.en Q5_1";

let runtimePromise = null;
let service = null;
let manager = null;
let modelReady = false;
let preparing = null;

async function runtime() {
  if (!runtimePromise) {
    runtimePromise = import("../../vendor/whisper-wasm/index.es.js");
  }
  return runtimePromise;
}

async function objects() {
  if (service && manager) return { service, manager };

  const { WhisperWasmService, ModelManager } = await runtime();
  service = new WhisperWasmService({ logLevel: 3 });
  manager = new ModelManager({ logLevel: 3 });
  return { service, manager };
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
    const { service, manager } = await objects();

    try {
      await navigator.storage?.persist?.();
    } catch {
      // Persistence is a best-effort browser request. Model caching still works
      // without it and the model can always be downloaded again.
    }

    onProgress(0, "Loading local voice model…");
    const model = await manager.loadModel(MODEL_ID, true, progress => {
      onProgress(progress, progress >= 100
        ? "Preparing Whisper…"
        : `Downloading local voice model… ${progress}%`);
    });

    await service.initModel(model);
    modelReady = true;
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

  const { service } = await objects();
  const { convertFromArrayBuffer } = await runtime();

  onProgress(100, "Preparing audio…");
  const buffer = await blob.arrayBuffer();
  const { audioData } = await convertFromArrayBuffer(buffer, {
    targetSampleRate: 16000,
    targetChannels: 1,
    normalize: true,
    noiseReduction: false,
    logLevel: "ERROR"
  });

  const hardwareThreads = Number(navigator.hardwareConcurrency) || 2;
  const threads = Math.max(1, Math.min(4, hardwareThreads));

  onProgress(100, "Transcribing locally…");
  const result = await service.transcribe(audioData, undefined, {
    language: "en",
    threads,
    translate: false
  });

  const transcript = result.segments
    .map(segment => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  onProgress(100, transcript ? "Transcription complete." : "No speech detected.");
  return transcript;
}
