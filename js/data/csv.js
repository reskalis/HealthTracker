import { APP_VERSION, BACKUP_SCHEMA_VERSION } from "../config/version.js";

export const CSV_COLUMNS = [
  "backup_schema_version",
  "app_version",
  "id",
  "datetime",
  "type",
  "sleep_hours",
  "sleep_quality",
  "energy",
  "weight_lb",
  "waist_in",
  "systolic",
  "diastolic",
  "pulse",
  "workout_type",
  "duration_min",
  "intensity",
  "notes"
];

const BACKUP_METADATA_COLUMNS = new Set([
  "backup_schema_version",
  "app_version"
]);

function escapeCsv(value = "") {
  const text = String(value);
  return /[",\n\r]/.test(text)
    ? '"' + text.replaceAll('"', '""') + '"'
    : text;
}

export function entriesToCsv(entries) {
  const rows = entries.map(entry => ({
    backup_schema_version: BACKUP_SCHEMA_VERSION,
    app_version: APP_VERSION,
    ...entry
  }));

  return [
    CSV_COLUMNS.join(","),
    ...rows.map(row =>
      CSV_COLUMNS.map(column => escapeCsv(row[column])).join(",")
    )
  ].join("\n");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

export function csvToEntries(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];

  const headers = rows.shift();
  const missing = ["datetime", "type"].filter(column => !headers.includes(column));

  if (missing.length) {
    throw new Error("Backup is missing required columns: " + missing.join(", "));
  }

  const schemaIndex = headers.indexOf("backup_schema_version");

  return rows
    .filter(row => row.some(Boolean))
    .map(row => {
      if (schemaIndex >= 0 && row[schemaIndex]) {
        const schemaVersion = Number(row[schemaIndex]);
        if (Number.isFinite(schemaVersion) && schemaVersion > BACKUP_SCHEMA_VERSION) {
          throw new Error(
            `This backup uses schema v${schemaVersion}, but this app supports up to v${BACKUP_SCHEMA_VERSION}.`
          );
        }
      }

      const entry = {};

      headers.forEach((header, index) => {
        if (
          row[index] !== undefined &&
          row[index] !== "" &&
          !BACKUP_METADATA_COLUMNS.has(header)
        ) {
          entry[header] = row[index];
        }
      });

      entry.id ||= crypto.randomUUID();
      return entry;
    });
}
