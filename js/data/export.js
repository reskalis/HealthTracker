import { entriesToCsv } from "./csv.js";

export async function exportBackup(entries) {
  const csv = entriesToCsv(entries);
  const blob = new Blob([csv], { type: "text/csv" });
  const file = new File([blob], "healthtracker_backup.csv", { type: "text/csv" });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if (error.name === "AbortError") return false;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
