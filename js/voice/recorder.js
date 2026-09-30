export function createVoiceRecorder({ onState = () => {}, onAudio = () => {} } = {}) {
  let stream = null;
  let recorder = null;
  let chunks = [];

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("Microphone recording is not supported by this browser.");
    }

    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.addEventListener("dataavailable", event => { if (event.data?.size) chunks.push(event.data); });
    recorder.addEventListener("stop", () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      onAudio(blob);
      stream?.getTracks().forEach(track => track.stop());
      stream = null;
      recorder = null;
      onState("ready");
    }, { once: true });
    recorder.start();
    onState("recording");
  }

  function stop() {
    if (recorder?.state === "recording") recorder.stop();
  }

  function dispose() {
    if (recorder?.state === "recording") recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    recorder = null;
  }

  return { start, stop, dispose };
}
