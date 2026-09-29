import { FORM_CONFIG } from "./config/forms.js";
import { getEntries, putEntry, clearEntries, migrateLegacyLocalStorage } from "./db/database.js";
import { exportBackup } from "./data/export.js";
import { csvToEntries } from "./data/csv.js";
import { renderFields } from "./ui/forms.js";
import { renderHistory } from "./ui/history.js";

const $ = selector => document.querySelector(selector);
let entries = [];
let activeForm = null;

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1500);
}

async function refresh() {
  entries = await getEntries();
  renderHistory($("#recent"), entries, FORM_CONFIG);
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
  await putEntry({
    id: crypto.randomUUID(),
    type: activeForm,
    datetime: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...data
  });
  $("#modal").close();
  await refresh();
  showToast("Saved");
}

async function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = csvToEntries(await file.text());
    for (const entry of imported) await putEntry(entry);
    await refresh();
    showToast(`Imported ${imported.length} entries`);
  } catch (error) {
    alert("Could not import backup: " + error.message);
  } finally {
    event.target.value = "";
  }
}

async function initialize() {
  const migrated = await migrateLegacyLocalStorage();
  await refresh();
  if (migrated) showToast(`Migrated ${migrated} existing entries`);

  document.querySelectorAll("[data-form]").forEach(button => {
    button.addEventListener("click", () => openForm(button.dataset.form));
  });
  $("#close").addEventListener("click", () => $("#modal").close());
  $("#entryForm").addEventListener("submit", handleSubmit);
  $("#backup").addEventListener("click", async () => {
    if (await exportBackup(entries)) {
      localStorage.setItem("healthtracker.lastBackup", new Date().toISOString());
      showToast("Backup exported");
    }
  });
  $("#import").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", handleImport);
  $("#clear").addEventListener("click", async () => {
    if (entries.length && confirm("Delete all locally stored HealthTracker entries? Export a backup first if you need one.")) {
      await clearEntries();
      await refresh();
    }
  });
}

$("#today").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
initialize().catch(error => {
  console.error(error);
  alert("HealthTracker could not start. Your existing data has not been intentionally deleted.");
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
