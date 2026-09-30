const DAY_MS = 24 * 60 * 60 * 1000;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const BACKUP_REMINDER_DAYS = 7;
export const BACKUP_SNOOZE_HOURS = 24;

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getBackupReminderState({
  recordCount,
  lastBackup,
  dismissedUntil,
  now = new Date()
}) {
  if (!recordCount) return { show: false };

  const dismissed = validDate(dismissedUntil);
  if (dismissed && dismissed > now) return { show: false };

  const backup = validDate(lastBackup);

  if (!backup) {
    return {
      show: true,
      message: recordCount === 1
        ? "You have 1 local record and no exported backup yet."
        : `You have ${recordCount} local records and no exported backup yet.`
    };
  }

  const ageDays = Math.floor((now - backup) / DAY_MS);
  if (ageDays < BACKUP_REMINDER_DAYS) return { show: false };

  return {
    show: true,
    message: `Your last exported backup was ${ageDays} days ago.`
  };
}

export function snoozeUntil(now = new Date()) {
  return new Date(
    now.getTime() + BACKUP_SNOOZE_HOURS * 60 * 60 * 1000
  ).toISOString();
}

function formatDate(date) {
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function renderRestorePreview(container, inspection, {
  fileName,
  currentRecordCount
}) {
  const counts = inspection.typeCounts;
  const typeSummary = [
    ["Sleep", counts.daily],
    ["Weight", counts.measurement],
    ["Blood pressure", counts.bp],
    ["Workouts", counts.workout]
  ]
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label}: ${count}`)
    .join(" • ");

  const legacyNote = inspection.legacy
    ? '<p class="safety-note">Older compatible backup detected. Missing stable IDs will be generated during restore.</p>'
    : "";

  container.innerHTML = `
    <dl class="restore-preview-grid">
      <div><dt>File</dt><dd>${escapeHtml(fileName)}</dd></div>
      <div><dt>Records</dt><dd>${inspection.recordCount}</dd></div>
      <div><dt>From</dt><dd>${formatDate(inspection.earliest)}</dd></div>
      <div><dt>Through</dt><dd>${formatDate(inspection.latest)}</dd></div>
    </dl>
    <p class="restore-type-summary">${typeSummary}</p>
    ${legacyNote}
    <p class="restore-replace-warning">
      Restoring will replace the ${currentRecordCount} record${currentRecordCount === 1 ? "" : "s"} currently stored on this device.
    </p>
  `;
}
