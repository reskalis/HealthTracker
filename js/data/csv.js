import { APP_VERSION, BACKUP_SCHEMA_VERSION } from "../config/version.js";

export const CSV_COLUMNS = [
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
  "notes",
  "backup_schema_version",
  "app_version"
];

export const BACKUP_METADATA_COLUMNS = new Set([
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

/**
 * Strict RFC-style CSV parser for restore files.
 * It rejects malformed quoting rather than guessing at the intended value.
 */
export function parseCsvRows(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let justClosedQuote = false;

  const finishField = () => {
    row.push(field);
    field = "";
    justClosedQuote = false;
  };

  const finishRow = () => {
    finishField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        justClosedQuote = true;
      } else {
        field += char;
      }
      continue;
    }

    if (justClosedQuote) {
      if (char === ",") {
        finishField();
      } else if (char === "\n") {
        finishRow();
      } else if (char === "\r" && source[i + 1] === "\n") {
        i++;
        finishRow();
      } else {
        throw new Error("Backup contains unexpected text after a quoted field.");
      }
      continue;
    }

    if (char === '"') {
      if (field.length) {
        throw new Error("Backup contains a quote inside an unquoted field.");
      }
      quoted = true;
    } else if (char === ",") {
      finishField();
    } else if (char === "\n") {
      finishRow();
    } else if (char === "\r" && source[i + 1] === "\n") {
      i++;
      finishRow();
    } else {
      field += char;
    }
  }

  if (quoted) {
    throw new Error("Backup contains an unterminated quoted field.");
  }

  if (justClosedQuote || field || row.length) {
    finishRow();
  }

  return rows;
}

/**
 * Backward-compatible entry-only parser.
 * New restore flows should use inspectBackup() from backup.js.
 */
export async function csvToEntries(text) {
  const { inspectBackup } = await import("./backup.js");
  return inspectBackup(text).entries;
}
