import test from "node:test";
import assert from "node:assert/strict";

import { entriesToCsv, parseCsvRows } from "../js/data/csv.js";
import { inspectBackup } from "../js/data/backup.js";
import { BACKUP_SCHEMA_VERSION } from "../js/config/version.js";

function workout(overrides = {}) {
  return {
    id: "workout-1",
    datetime: "2026-09-30T16:00:00.000Z",
    type: "workout",
    workout_type: "BJJ",
    duration_min: "60",
    intensity: "Hard",
    notes: 'Rounds, "shark tank"\nand drilling',
    ...overrides
  };
}

test("portable CSV round-trips commas, quotes, and newlines", () => {
  const source = [workout()];
  const csv = entriesToCsv(source);
  const inspection = inspectBackup(csv);

  assert.equal(inspection.recordCount, 1);
  assert.equal(inspection.schemaVersion, BACKUP_SCHEMA_VERSION);
  assert.equal(inspection.entries[0].id, source[0].id);
  assert.equal(inspection.entries[0].notes, source[0].notes);
  assert.equal(inspection.entries[0].workout_type, "BJJ");
});

test("strict CSV parser accepts BOM and CRLF", () => {
  const text = "\uFEFFdatetime,type,workout_type,duration_min,intensity\r\n" +
    "2026-09-30T16:00:00.000Z,workout,BJJ,45,Moderate\r\n";

  const inspection = inspectBackup(text);
  assert.equal(inspection.recordCount, 1);
  assert.equal(inspection.legacy, true);
  assert.equal(inspection.generatedIds, 1);
});

test("legacy compatible backup without id or metadata receives an id", () => {
  const text = [
    "datetime,type,workout_type,duration_min,intensity,notes",
    "2026-09-30T16:00:00.000Z,workout,Strength,30,Moderate,Test"
  ].join("\n");

  const inspection = inspectBackup(text);
  assert.equal(inspection.legacy, true);
  assert.equal(inspection.generatedIds, 1);
  assert.match(inspection.entries[0].id, /^[0-9a-f-]{36}$/i);
});

test("future backup schema is rejected", () => {
  const csv = entriesToCsv([workout({ notes: "Test" })]);
  const rows = parseCsvRows(csv);
  const schemaIndex = rows[0].indexOf("backup_schema_version");
  rows[1][schemaIndex] = String(BACKUP_SCHEMA_VERSION + 1);
  const futureCsv = rows.map(row => row.join(",")).join("\n");

  assert.throws(
    () => inspectBackup(futureCsv),
    /supports up to/
  );
});

test("duplicate headers are rejected", () => {
  assert.throws(
    () => inspectBackup(
      "datetime,type,type\n2026-09-30T16:00:00.000Z,workout,workout"
    ),
    /duplicate column/
  );
});

test("duplicate record IDs are rejected", () => {
  const csv = entriesToCsv([workout(), workout({
    datetime: "2026-09-30T18:00:00.000Z"
  })]);

  assert.throws(() => inspectBackup(csv), /duplicate record ID/);
});

test("invalid dates are rejected", () => {
  const csv = entriesToCsv([workout({ datetime: "not-a-date" })]);
  assert.throws(() => inspectBackup(csv), /invalid date\/time/);
});

test("unknown record types are rejected", () => {
  const csv = entriesToCsv([workout({ type: "mystery" })]);
  assert.throws(() => inspectBackup(csv), /unknown record type/);
});

test("missing required fields are rejected", () => {
  const csv = entriesToCsv([workout({ duration_min: "" })]);
  assert.throws(() => inspectBackup(csv), /missing required field "duration_min"/);
});

test("numeric values outside configured ranges are rejected", () => {
  const csv = entriesToCsv([workout({ duration_min: "2000" })]);
  assert.throws(() => inspectBackup(csv), /above the allowed maximum/);
});

test("unsupported select values are rejected", () => {
  const csv = entriesToCsv([workout({ intensity: "Impossible" })]);
  assert.throws(() => inspectBackup(csv), /unsupported value for "intensity"/);
});

test("malformed quoted fields are rejected", () => {
  assert.throws(
    () => parseCsvRows('a,b\n"unterminated,b'),
    /unterminated quoted field/
  );

  assert.throws(
    () => parseCsvRows('a,b\n"closed"x,y'),
    /unexpected text after a quoted field/
  );
});
