export function entrySummary(entry) {
  switch (entry.type) {
    case "measurement": return [entry.weight_lb && `${entry.weight_lb} lb`, entry.waist_in && `${entry.waist_in} in`].filter(Boolean).join(" • ");
    case "bp": return `${entry.systolic}/${entry.diastolic} • ${entry.pulse} bpm`;
    case "workout": return `${entry.workout_type} • ${entry.duration_min} min • ${entry.intensity}`;
    case "daily": return `${entry.sleep_hours}h sleep • energy ${entry.energy}/5`;
    default: return "Health entry";
  }
}

export function renderHistory(container, entries, config) {
  const recent = [...entries].reverse().slice(0, 8);
  container.innerHTML = recent.length ? recent.map(entry => `
    <div class="row">
      <div><b>${config[entry.type]?.title ?? "Entry"}</b><br><span>${entrySummary(entry)}</span></div>
      <span>${new Date(entry.datetime).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
    </div>`).join("") : '<div class="row"><span>No entries yet. Your first log will appear here.</span></div>';
}
