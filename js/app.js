import { FORM_CONFIG } from "./config/forms.js";
import {
  getEntries,
  putEntry,
  deleteEntry,
  replaceEntries,
  migrateLegacyLocalStorage
} from "./db/database.js";
import { exportBackup } from "./data/export.js";
import { csvToEntries } from "./data/csv.js";
import { renderFields } from "./ui/forms.js";
import { renderHistory } from "./ui/history.js";
import { renderDashboard } from "./ui/dashboard.js";
import { showToast } from "./ui/toast.js";
import { renderSystemStatus } from "./ui/status.js";
import { registerPwaUpdates } from "./pwa/update.js";

const $ = selector => document.querySelector(selector);

let entries = [];
let activeForm = null;
let activeEntryId = null;
let historyFilter = "all";
let dashboardRange = 30;
let offlineReady = false;
let online = navigator.onLine;

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

function refreshSystemStatus() {
  renderSystemStatus({
    recordCount: entries.length,
    lastBackup: localStorage.getItem("healthtracker.lastBackup"),
    offlineReady,
    online
  });
}

function renderCurrentHistory() {
  $("#historyCount").textContent = entries.length + (entries.length === 1 ? " record" : " records");

  renderHistory($("#history"), entries, FORM_CONFIG, {
    filter: historyFilter,
    onEdit: id => {
      const entry = entries.find(item => item.id === id);
      if (entry) openForm(entry.type, entry);
    },
    onDelete: handleDelete
  });
}

function renderCurrentDashboard() {
  renderDashboard($("#summaryCards"), $("#charts"), entries, dashboardRange);
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
      <input
        id="entryDatetime"
        name="datetime"
        type="datetime-local"
        value="${toLocalDateTimeInput(datetime)}"
        required
      >
    </div>
  ` + renderFields(config.fields, entry ?? {});

  $("#modal").showModal();
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
  if (!(await exportBackup(entries))) return;

  localStorage.setItem("healthtracker.lastBackup", new Date().toISOString());
  refreshSystemStatus();
  showToast("Backup exported");
}

async function handleRestore(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const imported = csvToEntries(await file.text());

    const confirmed = confirm(
      "Restore " + imported.length + " records from this backup? " +
      "This will replace the records currently stored on this device."
    );

    if (!confirmed) return;

    await replaceEntries(imported);
    await refresh();
    showToast("Restored " + imported.length + " records");
  } catch (error) {
    alert("Could not restore backup: " + error.message);
  } finally {
    event.target.value = "";
  }
}

function setDashboardRange(days) {
  dashboardRange = days;

  document.querySelectorAll("[data-range]").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.range) === days);
  });

  renderCurrentDashboard();
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

  document.querySelectorAll("[data-form]").forEach(button => {
    button.addEventListener("click", () => openForm(button.dataset.form));
  });

  document.querySelectorAll("[data-range]").forEach(button => {
    button.addEventListener("click", () => setDashboardRange(Number(button.dataset.range)));
  });

  $("#historyFilter").addEventListener("change", event => {
    historyFilter = event.target.value;
    renderCurrentHistory();
  });

  $("#close").addEventListener("click", () => {
    activeEntryId = null;
    $("#modal").close();
  });

  $("#entryForm").addEventListener("submit", handleSubmit);
  $("#backup").addEventListener("click", handleExport);
  $("#restore").addEventListener("click", () => $("#restoreInput").click());
  $("#restoreInput").addEventListener("change", handleRestore);

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
