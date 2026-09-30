import { entriesToCsv } from "./csv.js";

export async function exportBackup(entries) {
  const csv = entriesToCsv(entries);
  const blob = new Blob([csv], { type: "text/csv" });
  const file = new File([blob], "healthtracker_backup.csv", { type: "text/csv" });

  const touchCapable = navigator.maxTouchPoints > 0;
  const canShareFile =
    touchCapable &&
    navigator.share &&
    navigator.canShare?.({ files: [file] });

  if (canShareFile) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if (error.name === "AbortError") return false;
    }
  }

  // Desktop browsers provide a clearer backup workflow when Export creates a
  // normal downloaded CSV. Touch-capable devices keep the native share sheet,
  // where saving to Files is a natural part of the platform flow.
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
