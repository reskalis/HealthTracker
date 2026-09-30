import { parseVoiceTranscript, missingRequiredFields } from "../voice/parser.js";
import { createVoiceRecorder } from "../voice/recorder.js";

const LABELS = { daily: "🌙 Sleep", measurement: "⚖️ Weight", bp: "❤️ Blood pressure", workout: "🏋️ Workout" };
const FIELD_LABELS = { sleep_hours: "Sleep", sleep_quality: "Quality", energy: "Energy", weight_lb: "Weight", waist_in: "Waist", systolic: "Systolic", diastolic: "Diastolic", pulse: "Pulse", workout_type: "Type", duration_min: "Duration", intensity: "Intensity" };

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
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function renderDraft(draft) {
  const missing = missingRequiredFields(draft);
  const rows = Object.entries(draft.fields)
    .filter(([, value]) => value !== "")
    .map(([name, value]) => "<div><dt>" + escapeHtml(FIELD_LABELS[name] ?? name) + "</dt><dd>" + escapeHtml(valueLabel(name, value)) + "</dd></div>")
    .join("");

  return "<article class=\"voice-draft\"><strong>" + (LABELS[draft.type] ?? "Entry") + "</strong><dl>" +
    (rows || "<div><dt>Detected fields</dt><dd>None yet</dd></div>") + "</dl>" +
    (missing.length
      ? "<p class=\"voice-warning\">Needs review: " + missing.map(name => escapeHtml(FIELD_LABELS[name] ?? name)).join(", ") + "</p>"
      : "<p class=\"voice-ready\">Ready to save after review.</p>") +
    "</article>";
}

export function setupVoiceLab({
  dialog, openButton, closeButton, transcriptInput, parseButton, results,
  saveButton, recordButton, stopButton, audioEl, stateEl, onSaveDrafts
}) {
  if (!dialog || !openButton || !closeButton || !transcriptInput || !parseButton || !results) return;

  let drafts = [];
  let audioUrl = null;

  const setState = text => { if (stateEl) stateEl.textContent = text; };
  const updateSave = () => {
    if (!saveButton) return;
    saveButton.disabled = !drafts.length || drafts.some(draft => missingRequiredFields(draft).length);
  };

  const parse = () => {
    drafts = parseVoiceTranscript(transcriptInput.value);
    results.innerHTML = drafts.length
      ? drafts.map(renderDraft).join("")
      : '<p class="voice-empty">I could not confidently identify a HealthTracker entry yet.</p>';
    updateSave();
  };

  const recorder = createVoiceRecorder({
    onState: state => {
      if (recordButton) recordButton.disabled = state === "recording";
      if (stopButton) stopButton.disabled = state !== "recording";
      if (state === "recording") setState("Recording locally…");
      if (state === "ready") setState("Audio captured locally. Whisper transcription is the next integration step.");
    },
    onAudio: blob => {
      if (!audioEl) return;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = URL.createObjectURL(blob);
      audioEl.src = audioUrl;
      audioEl.hidden = false;
    }
  });

  openButton.addEventListener("click", () => {
    dialog.showModal();
    setState("Private voice test: audio stays on this device.");
  });
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", event => { event.preventDefault(); dialog.close(); });
  dialog.addEventListener("close", () => recorder.dispose());
  parseButton.addEventListener("click", parse);
  transcriptInput.addEventListener("input", () => {
    if (!transcriptInput.value.trim()) { drafts = []; results.innerHTML = ""; updateSave(); }
  });

  recordButton?.addEventListener("click", async () => {
    try { await recorder.start(); }
    catch (error) { setState(error.message || "Could not access the microphone."); }
  });
  stopButton?.addEventListener("click", () => recorder.stop());
  saveButton?.addEventListener("click", async () => {
    if (saveButton.disabled || !onSaveDrafts) return;
    saveButton.disabled = true;
    await onSaveDrafts(drafts);
    drafts = [];
    transcriptInput.value = "";
    results.innerHTML = "";
    dialog.close();
  });

  updateSave();
}
