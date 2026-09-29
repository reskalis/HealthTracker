import { FORM_CONFIG } from "./config/forms.js";
import { getEntries, putEntry, replaceEntries, migrateLegacyLocalStorage } from "./db/database.js";
import { exportBackup } from "./data/export.js";
import { csvToEntries } from "./data/csv.js";
import { renderFields } from "./ui/forms.js";
import { renderHistory } from "./ui/history.js";
import { showToast } from "./ui/toast.js";
import { renderSystemStatus } from "./ui/status.js";
import { registerPwaUpdates } from "./pwa/update.js";

const $ = selector => document.querySelector(selector);

let entries = [];
let activeForm = null;
let offlineReady = false;
let online = navigator.onLine;

function refreshSystemStatus() {
  renderSystemStatus({
    recordCount: entries.length,
    lastBackup: localStorage.getItem("healthtracker.lastBackup"),
    offlineReady,
    online
  });
}

async function refresh() {
  entries = await getEntries();
  renderHistory($("#recent"), entries, FORM_CONFIG);
  refreshSystemStatus();
}

function openForm(type) {
  activeForm = type;
  const config = FORM_CONFIG[type];

  $("#formTitle").textContent = config.title;
  $("#fields").innerHTML = renderFields(config.fields);
  $("#entryForm").reset();
  $("#modal").showModal();
}

async function handleSubmit(event) {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  const timestamp = new Date().toISOString();

  await putEntry({
    id: crypto.randomUUID(),
    type: activeForm,
    datetime: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    ...data
  });

  $("#modal").close();
  await refresh();
  showToast("Saved");
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

  $("#close").addEventListener("click", () => $("#modal").close());
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
