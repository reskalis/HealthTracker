const MODEL_ID = "base.en-q5_1";

let service = null;
let ready = false;

async function initialize() {
  if (ready) return;

  const { WhisperWasmService, ModelManager } =
    await import("../../vendor/whisper-wasm/index.es.js");

  const manager = new ModelManager({ logLevel: 3 });
  service = new WhisperWasmService({ logLevel: 2 });

  const model = await manager.loadModel(MODEL_ID, true);
  await service.initModel(model);
  ready = true;
}

self.addEventListener("message", async event => {
  const message = event.data ?? {};
  const id = message.id;

  try {
    if (message.type === "init") {
      await initialize();
      self.postMessage({ id, type: "ready" });
      return;
    }

    if (message.type === "transcribe") {
      await initialize();

      const audioData = new Float32Array(message.audioBuffer);
      const startedAt = Date.now();

      const result = await service.transcribe(
        audioData,
        segment => {
          self.postMessage({
            id,
            type: "segment",
            segment: {
              timeStart: segment.timeStart,
              timeEnd: segment.timeEnd,
              text: segment.text
            }
          });
        },
        {
          language: "en",
          threads: 1,
          translate: false
        }
      );

      self.postMessage({
        id,
        type: "result",
        result: {
          segments: (result?.segments ?? []).map(segment => ({
            timeStart: segment.timeStart,
            timeEnd: segment.timeEnd,
            text: segment.text
          })),
          transcribeDurationMs:
            result?.transcribeDurationMs ?? (Date.now() - startedAt)
        }
      });
      return;
    }
  } catch (error) {
    self.postMessage({
      id,
      type: "error",
      error: error?.message || String(error)
    });
  }
});
