import { DB_SCHEMA_VERSION } from "../config/version.js";

const DB_NAME = "HealthTracker";
const DB_VERSION = DB_SCHEMA_VERSION;
const STORE = "entries";
const LEGACY_KEY = "healthtracker.v1";

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("datetime", "datetime");
        store.createIndex("type", "type");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function store(mode = "readonly") {
  const db = await openDatabase();
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function getEntries() {
  const objectStore = await store();
  const entries = await requestToPromise(objectStore.getAll());
  return entries.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
}

export async function putEntry(entry) {
  const objectStore = await store("readwrite");
  await requestToPromise(objectStore.put(entry));
}

export async function deleteEntry(id) {
  const objectStore = await store("readwrite");
  await requestToPromise(objectStore.delete(id));
}

export async function clearEntries() {
  const objectStore = await store("readwrite");
  await requestToPromise(objectStore.clear());
}

export async function replaceEntries(entries) {
  const db = await openDatabase();

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const objectStore = transaction.objectStore(STORE);

    objectStore.clear();
    entries.forEach(entry => objectStore.put(entry));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** One-time migration from the prototype's localStorage database. */
export async function migrateLegacyLocalStorage() {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return 0;
  let entries;
  try { entries = JSON.parse(raw); } catch { return 0; }
  if (!Array.isArray(entries)) return 0;
  for (const entry of entries) await putEntry(entry);
  localStorage.removeItem(LEGACY_KEY);
  return entries.length;
}
