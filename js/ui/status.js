import {
  APP_VERSION,
  BUILD_ID,
  DB_SCHEMA_VERSION,
  BACKUP_SCHEMA_VERSION
} from "../config/version.js";

function formatBackupDate(value) {
  if (!value) return "No backup yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Backup date unavailable";
  return "Last backup: " + date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function renderSystemStatus({
  recordCount,
  lastBackup,
  offlineReady,
  online
}) {
  document.querySelector("#appVersion").textContent = `v${APP_VERSION}`;
  document.querySelector("#buildId").textContent = BUILD_ID;
  document.querySelector("#recordCount").textContent = String(recordCount);
  document.querySelector("#dbVersion").textContent = `v${DB_SCHEMA_VERSION}`;
  document.querySelector("#backupVersion").textContent = `v${BACKUP_SCHEMA_VERSION}`;
  document.querySelector("#lastBackup").textContent = formatBackupDate(lastBackup);

  const offlineElement = document.querySelector("#offlineStatus");
  offlineElement.textContent = offlineReady ? "Offline ready" : "Offline setup pending";

  const networkElement = document.querySelector("#networkStatus");
  networkElement.textContent = online ? "Online" : "Offline";
  networkElement.dataset.state = online ? "online" : "offline";
}
