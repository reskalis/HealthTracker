import { parseVoiceTranscript, missingRequiredFields } from "../voice/parser.js";

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

export function setupVoiceLab({ dialog, openButton, closeButton, transcriptInput, parseButton, results }) {
  if (!dialog || !openButton || !closeButton || !transcriptInput || !parseButton || !results) return;

  const parse = () => {
    const drafts = parseVoiceTranscript(transcriptInput.value);
    results.innerHTML = drafts.length
      ? drafts.map(renderDraft).join("")
      : '<p class="voice-empty">I could not confidently identify a HealthTracker entry yet.</p>';
  };

  openButton.addEventListener("click", () => { dialog.showModal(); transcriptInput.focus(); });
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", event => { event.preventDefault(); dialog.close(); });
  parseButton.addEventListener("click", parse);
  transcriptInput.addEventListener("input", () => { if (!transcriptInput.value.trim()) results.innerHTML = ""; });
}
