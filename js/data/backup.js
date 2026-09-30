import { FORM_CONFIG } from "../config/forms.js";
import { BACKUP_SCHEMA_VERSION } from "../config/version.js";
import {
  CSV_COLUMNS,
  BACKUP_METADATA_COLUMNS,
  parseCsvRows
} from "./csv.js";

const REQUIRED_COLUMNS = ["datetime", "type"];
const INTERNAL_COLUMNS = ["created_at", "updated_at"];
const ALLOWED_COLUMNS = new Set([...CSV_COLUMNS, ...INTERNAL_COLUMNS]);
const VALID_TYPES = new Set(Object.keys(FORM_CONFIG));

function ensureUniqueHeaders(headers) {
  const seen = new Set();

  for (const header of headers) {
    if (!header) throw new Error("Backup contains an empty column name.");
    if (seen.has(header)) {
      throw new Error("Backup contains a duplicate column: " + header);
    }
    seen.add(header);
  }
}

function validateHeaders(headers) {
  ensureUniqueHeaders(headers);

  const missing = REQUIRED_COLUMNS.filter(column => !headers.includes(column));
  if (missing.length) {
    throw new Error("Backup is missing required columns: " + missing.join(", "));
  }

  const unknown = headers.filter(column => !ALLOWED_COLUMNS.has(column));
  if (unknown.length) {
    throw new Error("Backup contains unsupported columns: " + unknown.join(", "));
  }
}

function parseSchemaVersion(value) {
  if (value === undefined || value === "") return null;

  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("Backup contains an invalid backup schema version.");
  }

  if (version > BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `This backup uses schema v${version}, but this app supports up to v${BACKUP_SCHEMA_VERSION}.`
    );
  }

  return version;
}

function validateDate(value, rowNumber) {
  if (!value) {
    throw new Error(`Row ${rowNumber} is missing a date/time.`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Row ${rowNumber} has an invalid date/time: ${value}`);
  }

  return date;
}

function validateField(field, value, rowNumber) {
  if (field.required && (value === undefined || value === "")) {
    throw new Error(`Row ${rowNumber} is missing required field "${field.name}".`);
  }

  if (value === undefined || value === "") return;

  if (field.type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error(`Row ${rowNumber} has a non-numeric value for "${field.name}".`);
    }
    if (field.min !== undefined && number < field.min) {
      throw new Error(`Row ${rowNumber} has "${field.name}" below the allowed minimum.`);
    }
    if (field.max !== undefined && number > field.max) {
      throw new Error(`Row ${rowNumber} has "${field.name}" above the allowed maximum.`);
    }
  }

  if (field.type === "select") {
    const allowed = new Set(field.options.map(option => String(option.value)));
    if (!allowed.has(String(value))) {
      throw new Error(`Row ${rowNumber} has an unsupported value for "${field.name}".`);
    }
  }
}

function validateEntry(entry, rowNumber) {
  if (!VALID_TYPES.has(entry.type)) {
    throw new Error(`Row ${rowNumber} has an unknown record type: ${entry.type || "(blank)"}`);
  }

  const config = FORM_CONFIG[entry.type];
  for (const field of config.fields) {
    validateField(field, entry[field.name], rowNumber);
  }
}

function summarizeEntries(entries) {
  const typeCounts = Object.fromEntries(
    Object.keys(FORM_CONFIG).map(type => [type, 0])
  );

  let earliest = null;
  let latest = null;

  for (const entry of entries) {
    typeCounts[entry.type] += 1;
    const date = new Date(entry.datetime);

    if (!earliest || date < earliest) earliest = date;
    if (!latest || date > latest) latest = date;
  }

  return { typeCounts, earliest, latest };
}

/**
 * Fully validates a portable HealthTracker CSV before the database is touched.
 * No partial restore is possible: callers only receive entries after every row
 * has passed structural and semantic validation.
 */
export function inspectBackup(text) {
  const rows = parseCsvRows(text);

  if (!rows.length) {
    throw new Error("Backup is empty.");
  }

  const headers = rows.shift().map(header => header.trim());
  validateHeaders(headers);

  const schemaIndex = headers.indexOf("backup_schema_version");
  const appVersionIndex = headers.indexOf("app_version");
  const idIndex = headers.indexOf("id");

  const entries = [];
  const ids = new Set();
  const schemaVersions = new Set();
  const appVersions = new Set();
  let generatedIds = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    if (!row.some(value => value !== "")) return;

    if (row.length !== headers.length) {
      throw new Error(
        `Row ${rowNumber} has ${row.length} columns; expected ${headers.length}.`
      );
    }

    if (schemaIndex >= 0) {
      const schemaVersion = parseSchemaVersion(row[schemaIndex]);
      if (schemaVersion !== null) schemaVersions.add(schemaVersion);
    }

    if (appVersionIndex >= 0 && row[appVersionIndex]) {
      appVersions.add(row[appVersionIndex]);
    }

    const entry = {};

    headers.forEach((header, columnIndex) => {
      if (
        row[columnIndex] !== undefined &&
        row[columnIndex] !== "" &&
        !BACKUP_METADATA_COLUMNS.has(header)
      ) {
        entry[header] = row[columnIndex];
      }
    });

    validateDate(entry.datetime, rowNumber);
    validateEntry(entry, rowNumber);

    if (!entry.id) {
      entry.id = crypto.randomUUID();
      generatedIds += 1;
    }

    if (ids.has(entry.id)) {
      throw new Error(`Backup contains a duplicate record ID: ${entry.id}`);
    }
    ids.add(entry.id);

    entry.created_at ||= entry.datetime;
    entry.updated_at ||= new Date().toISOString();
    entries.push(entry);
  });

  if (!entries.length) {
    throw new Error("Backup contains no health records.");
  }

  if (schemaVersions.size > 1) {
    throw new Error("Backup mixes multiple backup schema versions.");
  }

  const summary = summarizeEntries(entries);

  return {
    entries,
    recordCount: entries.length,
    typeCounts: summary.typeCounts,
    earliest: summary.earliest,
    latest: summary.latest,
    schemaVersion: schemaVersions.size ? [...schemaVersions][0] : null,
    appVersion: appVersions.size === 1 ? [...appVersions][0] : null,
    generatedIds,
    legacy: idIndex < 0 || schemaIndex < 0
  };
}
