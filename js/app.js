import { FORM_CONFIG } from "./config/forms.js";
import {
  getEntries,
  putEntry,
  deleteEntry,
  clearEntries,
  replaceEntries,
  migrateLegacyLocalStorage
} from "./db/database.js";
import { exportBackup } from "./data/export.js";
import { inspectBackup } from "./data/backup.js";
import { renderFields } from "./ui/forms.js";
import { renderHistory } from "./ui/history.js";
import { renderDashboard } from "./ui/dashboard.js";
import {
  getBackupReminderState,
  snoozeUntil,
  renderRestorePreview
} from "./ui/data-safety.js";
import { showToast } from "./ui/toast.js";
import { renderSystemStatus } from "./ui/status.js";
import { registerPwaUpdates } from "./pwa/update.js";
import { setupInstallPrompt } from "./ui/install.js";
import { applyVoiceExperimentFlag } from "./voice/feature.js";
import { setupVoiceLab } from "./ui/voice.js";

const $ = selector => document.querySelector(selector);
const LAST_BACKUP_KEY = "healthtracker.lastBackup";
const BACKUP_SNOOZE_KEY = "healthtracker.backupReminderDismissedUntil";

let entries = [];
let activeForm = null;
let activeEntryId = null;
let historyFilter = "all";
let historyLimit = 50;
let dashboardRange = 30;
let offlineReady = false;
let online = navigator.onLine;
let pendingRestore = null;

function toLocalDateTimeInput(isoString) {
  const date = new Date(isoString);
  const pad = value => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + "T" + [
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join(":");
}

function formatDateTimeDisplay(localDateTime) {
  if (!localDateTime) return "Choose date & time";

  const date = new Date(localDateTime);
  if (Number.isNaN(date.getTime())) return "Choose date & time";

  const month = date.toLocaleDateString(undefined, { month: "short" });
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${date.getFullYear()} ${month} ${day}, ${hour}:${minute}`;
}

function syncDateTimeDisplay() {
  const input = $("#entryDatetime");
  const display = $("#entryDatetimeDisplay");
  if (!input || !display) return;

  display.textContent = formatDateTimeDisplay(input.value);
}

function requestNativeDateTimePicker(input) {
  if (typeof input?.showPicker !== "function") return;

  try {
    input.showPicker();
  } catch (error) {
    // Browsers may reject showPicker() outside an allowed user gesture.
    // Native input behavior remains the fallback.
    if (error?.name !== "NotAllowedError") {
      console.debug("Native date/time picker request was unavailable:", error);
    }
  }
}

function refreshBackupReminder() {
  const state = getBackupReminderState({
    recordCount: entries.length,
    lastBackup: localStorage.getItem(LAST_BACKUP_KEY),
    dismissedUntil: localStorage.getItem(BACKUP_SNOOZE_KEY)
  });

  $("#backupReminder").hidden = !state.show;
  $("#backupReminderText").textContent = state.message ?? "";
}

function refreshSystemStatus() {
  renderSystemStatus({
    recordCount: entries.length,
    lastBackup: localStorage.getItem(LAST_BACKUP_KEY),
    offlineReady,
    online
  });

  $("#deleteAllData").disabled = entries.length === 0;
  refreshBackupReminder();
}

function renderCurrentHistory() {
  const historyPanel = document.querySelector(".history-panel");
  const empty = entries.length === 0;

  $("#historyCount").textContent = empty
    ? "No records"
    : entries.length + (entries.length === 1 ? " record" : " records");

  historyPanel.classList.toggle("history-panel-empty", empty);
  if (empty) historyPanel.open = false;

  renderHistory($("#history"), entries, FORM_CONFIG, {
    filter: historyFilter,
    limit: historyLimit,
    onEdit: id => {
      const entry = entries.find(item => item.id === id);
      if (entry) openForm(entry.type, entry);
    },
    onDelete: handleDelete,
    onShowOlder: () => {
      historyLimit += 50;
      renderCurrentHistory();
    }
  });
}

function renderCurrentDashboard() {
  renderDashboard($("#trendCards"), entries, dashboardRange);
}

async function refresh() {
  entries = await getEntries();
  renderCurrentHistory();
  renderCurrentDashboard();
  refreshSystemStatus();
}

function openForm(type, entry = null) {
  activeForm = type;
  activeEntryId = entry?.id ?? null;

  const config = FORM_CONFIG[type];
  const datetime = entry?.datetime ?? new Date().toISOString();
  const titlePrefix = entry ? "Edit " : "";

  $("#formTitle").textContent = titlePrefix + config.title;
  $("#saveEntry").textContent = entry ? "Save changes" : "Save entry";

  $("#fields").innerHTML = `
    <div class="field">
      <label for="entryDatetime">Date & time</label>
      <div class="datetime-field-shell">
        <span id="entryDatetimeDisplay" class="datetime-field-display" aria-hidden="true"></span>
        <input
          id="entryDatetime"
          name="datetime"
          type="datetime-local"
          value="${toLocalDateTimeInput(datetime)}"
          required
        >
      </div>
    </div>
  ` + renderFields(config.fields, entry ?? {});

  $("#modal").showModal();

  const datetimeInput = $("#entryDatetime");
  datetimeInput.addEventListener("input", syncDateTimeDisplay);
  datetimeInput.addEventListener("change", syncDateTimeDisplay);
  datetimeInput.addEventListener("click", event => {
    if (event.pointerType === "touch") return;
    requestNativeDateTimePicker(datetimeInput);
  });
  datetimeInput.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      requestNativeDateTimePicker(datetimeInput);
    }
  });
  syncDateTimeDisplay();
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
  const localDatetime = formData.datetime;
  delete formData.datetime;

  const timestamp = new Date().toISOString();
  const existing = activeEntryId
    ? entries.find(entry => entry.id === activeEntryId)
    : null;

  await putEntry({
    ...existing,
    id: existing?.id ?? crypto.randomUUID(),
    type: activeForm,
    datetime: new Date(localDatetime).toISOString(),
    created_at: existing?.created_at ?? timestamp,
    updated_at: timestamp,
    ...formData
  });

  $("#modal").close();
  activeEntryId = null;
  await refresh();
  showToast(existing ? "Changes saved" : "Saved");
}

async function handleDelete(id) {
  const entry = entries.find(item => item.id === id);
  if (!entry) return;

  const title = FORM_CONFIG[entry.type]?.title ?? "entry";
  if (!confirm("Delete this " + title.toLowerCase() + "? This cannot be undone unless it exists in a backup.")) {
    return;
  }

  await deleteEntry(id);
  await refresh();
  showToast("Entry deleted");
}

async function handleExport() {
  if (!(await exportBackup(entries))) return false;

  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  localStorage.removeItem(BACKUP_SNOOZE_KEY);
  refreshSystemStatus();
  showToast("Backup exported");
  return true;
}

function closeRestoreDialog() {
  pendingRestore = null;
  $("#restoreDialog").close();
}

async function handleRestoreFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const inspection = inspectBackup(await file.text());
    pendingRestore = {
      inspection,
      fileName: file.name
    };

    renderRestorePreview($("#restorePreview"), inspection, {
      fileName: file.name,
      currentRecordCount: entries.length
    });

    $("#restoreDialog").showModal();
  } catch (error) {
    alert("Could not restore backup: " + error.message);
  } finally {
    event.target.value = "";
  }
}

async function confirmRestore() {
  if (!pendingRestore) return;

  const inspection = pendingRestore.inspection;
  await replaceEntries(inspection.entries);

  // The restored records came from an external backup file, so the current
  // dataset has a known portable copy at the time of restore.
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  localStorage.removeItem(BACKUP_SNOOZE_KEY);

  closeRestoreDialog();
  await refresh();
  showToast("Restored " + inspection.recordCount + " records");
}

function openDeleteAllDialog() {
  $("#deleteConfirmation").value = "";
  $("#confirmDeleteAll").disabled = true;
  $("#deleteDataDialog").showModal();
}

function closeDeleteAllDialog() {
  $("#deleteConfirmation").value = "";
  $("#confirmDeleteAll").disabled = true;
  $("#deleteDataDialog").close();
}

async function confirmDeleteAll() {
  if ($("#deleteConfirmation").value.trim() !== "DELETE") return;

  await clearEntries();
  localStorage.removeItem(LAST_BACKUP_KEY);
  localStorage.removeItem(BACKUP_SNOOZE_KEY);

  closeDeleteAllDialog();
  await refresh();
  showToast("Local health data deleted");
}

function setDashboardRange(days) {
  dashboardRange = days;

  document.querySelectorAll("[data-range]").forEach(button => {
    const selected = Number(button.dataset.range) === days;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  renderCurrentDashboard();
}

async function saveVoiceDrafts(drafts) {
  const timestamp = new Date().toISOString();

  for (const draft of drafts) {
    await putEntry({
      id: crypto.randomUUID(),
      type: draft.type,
      datetime: draft.datetime,
      created_at: timestamp,
      updated_at: timestamp,
      ...draft.fields
    });
  }

  await refresh();
  showToast(drafts.length === 1 ? "Voice entry saved" : drafts.length + " voice entries saved");
}

async function initializePwa() {
  try {
    await registerPwaUpdates({
      banner: $("#updateBanner"),
      reloadButton: $("#reloadUpdate"),
      onReady: ready => {
        offlineReady = ready;
        refreshSystemStatus();
      },
      onOnlineChange: isOnline => {
        online = isOnline;
        refreshSystemStatus();
      }
    });
  } catch (error) {
    console.error("Service worker setup failed:", error);
    offlineReady = false;
    refreshSystemStatus();
  }
}

async function initialize() {
  const migrated = await migrateLegacyLocalStorage();

  $("#today").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

  setupInstallPrompt({
    prompt: $("#installPrompt"),
    dismissButton: $("#dismissInstallPrompt")
  });

  const voiceEnabled = applyVoiceExperimentFlag();
  $("#talk").hidden = !voiceEnabled;

  if (voiceEnabled) {
    setupVoiceLab({
      dialog: $("#voiceDialog"),
      openButton: $("#talk"),
      closeButton: $("#closeVoice"),
      transcriptInput: $("#voiceTranscript"),
      parseButton: $("#parseVoiceTranscript"),
      results: $("#voiceResults"),
      saveButton: $("#saveVoiceDrafts"),
      recordButton: $("#startVoiceRecording"),
      stopButton: $("#stopVoiceRecording"),
      audioEl: $("#voiceAudio"),
      stateEl: $("#voiceState"),
      installModelButton: $("#installVoiceModel"),
      modelStatusEl: $("#voiceModelStatus"),
      modelProgressEl: $("#voiceModelProgress"),
      diagnosticsEl: $("#voiceDiagnostics"),
      copyDiagnosticsButton: $("#copyVoiceDiagnostics"),
      onSaveDrafts: saveVoiceDrafts
    });
  }

  document.querySelectorAll("[data-form]").forEach(button => {
    button.addEventListener("click", () => openForm(button.dataset.form));
  });

  document.querySelectorAll("[data-range]").forEach(button => {
    button.setAttribute(
      "aria-pressed",
      String(Number(button.dataset.range) === dashboardRange)
    );
    button.addEventListener("click", () => setDashboardRange(Number(button.dataset.range)));
  });

  $("#historyFilter").addEventListener("change", event => {
    historyFilter = event.target.value;
    historyLimit = 50;
    renderCurrentHistory();
  });

  $("#historySummary").addEventListener("click", event => {
    if (entries.length === 0) event.preventDefault();
  });

  $("#close").addEventListener("click", () => {
    activeEntryId = null;
    $("#modal").close();
  });

  $("#entryForm").addEventListener("submit", handleSubmit);
  $("#backup").addEventListener("click", handleExport);
  $("#restore").addEventListener("click", () => $("#restoreInput").click());
  $("#restoreInput").addEventListener("change", handleRestoreFile);

  $("#backupReminderExport").addEventListener("click", handleExport);
  $("#backupReminderLater").addEventListener("click", () => {
    localStorage.setItem(BACKUP_SNOOZE_KEY, snoozeUntil());
    refreshBackupReminder();
  });

  $("#cancelRestore").addEventListener("click", closeRestoreDialog);
  $("#cancelRestoreTop").addEventListener("click", closeRestoreDialog);
  $("#restoreDialog").addEventListener("cancel", event => {
    event.preventDefault();
    closeRestoreDialog();
  });
  $("#confirmRestore").addEventListener("click", confirmRestore);
  $("#backupBeforeRestore").addEventListener("click", handleExport);

  $("#deleteAllData").addEventListener("click", openDeleteAllDialog);
  $("#cancelDelete").addEventListener("click", closeDeleteAllDialog);
  $("#cancelDeleteTop").addEventListener("click", closeDeleteAllDialog);
  $("#deleteDataDialog").addEventListener("cancel", event => {
    event.preventDefault();
    closeDeleteAllDialog();
  });
  $("#backupBeforeDelete").addEventListener("click", handleExport);
  $("#deleteConfirmation").addEventListener("input", event => {
    $("#confirmDeleteAll").disabled = event.target.value.trim() !== "DELETE";
  });
  $("#confirmDeleteAll").addEventListener("click", confirmDeleteAll);

  await refresh();
  if (migrated) showToast("Migrated " + migrated + " existing entries");

  await initializePwa();
}

initialize().catch(error => {
  console.error(error);
  alert(
    "HealthTracker could not start. Your existing data has not been intentionally deleted."
  );
});
