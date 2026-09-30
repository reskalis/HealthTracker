import { parseVoiceTranscript, missingRequiredFields } from "../voice/parser.js";
import { createVoiceRecorder } from "../voice/recorder.js";
import {
  VOICE_MODEL_SIZE_MB,
  prepareVoiceModel,
  transcribeVoiceAudio,
  voiceModelStatus
} from "../voice/whisper-upstream.js";

const LABELS = {
  daily: "🌙 Sleep",
  measurement: "⚖️ Weight",
  bp: "❤️ Blood pressure",
  workout: "🏋️ Workout"
};

const FIELD_LABELS = {
  sleep_hours: "Sleep",
  sleep_quality: "Quality",
  energy: "Energy",
  weight_lb: "Weight",
  waist_in: "Waist",
  systolic: "Systolic",
  diastolic: "Diastolic",
  pulse: "Pulse",
  workout_type: "Type",
  duration_min: "Duration",
  intensity: "Intensity"
};

function valueLabel(name, value) {
  if (!value) return "—";
  if (name === "sleep_hours") return value + " hr";
  if (name === "weight_lb") return value + " lb";
  if (name === "waist_in") return value + " in";
  if (name === "pulse") return value + " bpm";
  if (name === "duration_min") return value + " min";
  if (name === "sleep_quality" || name === "energy") return value + "/5";
  return value;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderDraft(draft) {
  const missing = missingRequiredFields(draft);
  const rows = Object.entries(draft.fields)
    .filter(([, value]) => value !== "")
    .map(([name, value]) =>
      "<div><dt>" + escapeHtml(FIELD_LABELS[name] ?? name) +
      "</dt><dd>" + escapeHtml(valueLabel(name, value)) + "</dd></div>"
    )
    .join("");

  return "<article class=\"voice-draft\"><strong>" +
    (LABELS[draft.type] ?? "Entry") +
    "</strong><dl>" +
    (rows || "<div><dt>Detected fields</dt><dd>None yet</dd></div>") +
    "</dl>" +
    (missing.length
      ? "<p class=\"voice-warning\">Needs review: " +
        missing.map(name => escapeHtml(FIELD_LABELS[name] ?? name)).join(", ") +
        "</p>"
      : "<p class=\"voice-ready\">Ready to save after review.</p>") +
    "</article>";
}

export function setupVoiceLab({
  dialog,
  openButton,
  closeButton,
  transcriptInput,
  parseButton,
  results,
  saveButton,
  recordButton,
  stopButton,
  audioEl,
  stateEl,
  installModelButton,
  modelStatusEl,
  modelProgressEl,
  diagnosticsEl,
  copyDiagnosticsButton,
  onSaveDrafts
}) {
  if (!dialog || !openButton || !closeButton || !transcriptInput || !parseButton || !results) return;

  let drafts = [];
  let audioUrl = null;
  let modelReady = false;
  let busy = false;

  const setState = text => {
    if (stateEl) stateEl.textContent = text;
  };

  const setModelStatus = text => {
    if (modelStatusEl) modelStatusEl.textContent = text;
  };

  const setProgress = value => {
    if (!modelProgressEl) return;
    modelProgressEl.value = Math.max(0, Math.min(100, Number(value) || 0));
  };

  const updateControls = () => {
    if (recordButton) recordButton.disabled = busy || !modelReady;
    if (stopButton && !busy) stopButton.disabled = true;
    if (installModelButton) installModelButton.disabled = busy || modelReady;
  };

  const updateSave = () => {
    if (!saveButton) return;
    saveButton.disabled =
      busy ||
      !drafts.length ||
      drafts.some(draft => missingRequiredFields(draft).length);
  };

  const parse = () => {
    drafts = parseVoiceTranscript(transcriptInput.value);
    results.innerHTML = drafts.length
      ? drafts.map(renderDraft).join("")
      : '<p class="voice-empty">I could not confidently identify a HealthTracker entry yet.</p>';
    updateSave();
  };

  const prepareModel = async () => {
    busy = true;
    updateControls();
    updateSave();
    try {
      await prepareVoiceModel((progress, message) => {
        setProgress(progress);
        setModelStatus(message);
      });
      modelReady = true;
      setProgress(100);
      setModelStatus("Local Whisper model ready.");
      setState("Ready. Tap Record and speak naturally.");
    } catch (error) {
      modelReady = false;
      setModelStatus("Voice model could not be prepared.");
      setState(error?.message || "Could not load the local voice model.");
    } finally {
      busy = false;
      updateControls();
      updateSave();
    }
  };

  const checkModel = async () => {
    busy = true;
    updateControls();
    try {
      const status = await voiceModelStatus();
      if (status.installed) {
        setModelStatus("Local model found. Preparing…");
        await prepareModel();
      } else {
        modelReady = false;
        setProgress(0);
        setModelStatus(
          "Local Whisper model not installed. Download once (" +
          VOICE_MODEL_SIZE_MB +
          " MB) to enable offline transcription."
        );
        setState("Install the local model, then record.");
      }
    } catch (error) {
      modelReady = false;
      setModelStatus("Could not check local voice model.");
      setState(error?.message || "Voice setup is unavailable in this browser.");
    } finally {
      busy = false;
      updateControls();
    }
  };

  const recorder = createVoiceRecorder({
    onState: state => {
      if (state === "recording") {
        busy = false;
        if (recordButton) recordButton.disabled = true;
        if (stopButton) stopButton.disabled = false;
        setState("Recording locally…");
      }
    },
    onAudio: async blob => {
      if (audioEl) {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        audioUrl = URL.createObjectURL(blob);
        audioEl.src = audioUrl;
        audioEl.hidden = false;
      }

      busy = true;
      updateControls();
      updateSave();

      try {
        const { transcript, diagnostics } = await transcribeVoiceAudio(blob, {
          onProgress: (progress, message) => {
            setProgress(progress);
            setState(message);
          }
        });

        if (diagnosticsEl) {
          diagnosticsEl.textContent = JSON.stringify(diagnostics, null, 2);
        }

        transcriptInput.value = transcript;
        if (transcript) {
          parse();
        } else {
          drafts = [];
          results.innerHTML = '<p class="voice-empty">Whisper did not detect speech. Try recording again.</p>';
          updateSave();
        }
      } catch (error) {
        drafts = [];
        results.innerHTML = "";
        setState(error?.message || "Local transcription failed.");
        updateSave();
      } finally {
        busy = false;
        updateControls();
        updateSave();
      }
    }
  });

  openButton.addEventListener("click", () => {
    dialog.showModal();
    setState("Checking local voice model…");
    checkModel();
  });

  closeButton.addEventListener("click", () => dialog.close());

  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    dialog.close();
  });

  dialog.addEventListener("close", () => recorder.dispose());

  installModelButton?.addEventListener("click", prepareModel);
  parseButton.addEventListener("click", parse);

  transcriptInput.addEventListener("input", () => {
    if (!transcriptInput.value.trim()) {
      drafts = [];
      results.innerHTML = "";
      updateSave();
    }
  });

  recordButton?.addEventListener("click", async () => {
    try {
      await recorder.start();
    } catch (error) {
      setState(error?.message || "Could not access the microphone.");
      busy = false;
      updateControls();
    }
  });

  stopButton?.addEventListener("click", () => recorder.stop());

  copyDiagnosticsButton?.addEventListener("click", async () => {
    const text = diagnosticsEl?.textContent?.trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setState("Diagnostics copied.");
    } catch {
      setState("Could not copy diagnostics automatically. Select and copy them manually.");
    }
  });

  saveButton?.addEventListener("click", async () => {
    if (saveButton.disabled || !onSaveDrafts) return;

    busy = true;
    updateSave();

    try {
      await onSaveDrafts(drafts);
      drafts = [];
      transcriptInput.value = "";
      results.innerHTML = "";
      dialog.close();
    } finally {
      busy = false;
      updateSave();
    }
  });

  updateControls();
  updateSave();
}
