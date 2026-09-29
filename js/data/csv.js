export const CSV_COLUMNS = [
  "datetime", "type", "sleep_hours", "sleep_quality", "energy",
  "weight_lb", "waist_in", "systolic", "diastolic", "pulse",
  "workout_type", "duration_min", "intensity", "notes"
];

function escapeCsv(value = "") {
  const text = String(value);
  return /[",\n\r]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

export function entriesToCsv(entries) {
  return [
    CSV_COLUMNS.join(","),
    ...entries.map(entry => CSV_COLUMNS.map(column => escapeCsv(entry[column])).join(","))
  ].join("\n");
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

export function csvToEntries(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows.shift();
  const missing = ["datetime", "type"].filter(column => !headers.includes(column));
  if (missing.length) throw new Error("Backup is missing required columns: " + missing.join(", "));
  return rows.filter(row => row.some(Boolean)).map(row => {
    const entry = {};
    headers.forEach((header, index) => { if (row[index] !== undefined && row[index] !== "") entry[header] = row[index]; });
    entry.id = crypto.randomUUID();
    return entry;
  });
}
