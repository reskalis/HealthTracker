import { CSV_COLUMNS } from "./export.js";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') { field += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(field); field = "";
      if (row.some(value => value !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some(value => value !== "")) rows.push(row);
  return rows;
}

export async function importBackup(file) {
  const rows = parseCsv(await file.text());
  if (rows.length < 2) throw new Error("This backup does not contain any records.");
  const headers = rows[0];
  if (!["datetime", "type"].every(column => headers.includes(column))) throw new Error("This is not a recognized HealthTracker backup.");

  return rows.slice(1).map(values => {
    const entry = {};
    headers.forEach((header, index) => {
      if (CSV_COLUMNS.includes(header) && values[index] !== "") entry[header] = values[index];
    });
    entry.id ||= crypto.randomUUID();
    return entry;
  });
}
