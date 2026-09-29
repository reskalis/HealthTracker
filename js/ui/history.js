function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function entrySummary(entry) {
  switch (entry.type) {
    case "measurement":
      return [entry.weight_lb && `${entry.weight_lb} lb`, entry.waist_in && `${entry.waist_in} in`]
        .filter(Boolean).join(" • ");
    case "bp":
      return `${entry.systolic}/${entry.diastolic} • ${entry.pulse} bpm`;
    case "workout":
      return `${entry.workout_type} • ${entry.duration_min} min • ${entry.intensity}`;
    case "daily":
      return `${entry.sleep_hours}h sleep • quality ${entry.sleep_quality}/5 • energy ${entry.energy}/5`;
    default:
      return "Health entry";
  }
}

export function renderHistory(container, entries, config, {
  filter = "all",
  onEdit = () => {},
  onDelete = () => {}
} = {}) {
  const filtered = entries
    .filter(entry => filter === "all" || entry.type === filter)
    .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

  if (!filtered.length) {
    container.innerHTML = '<div class="row"><span>No entries in this view yet.</span></div>';
    return;
  }

  container.innerHTML = filtered.map(entry => `
    <article class="history-row">
      <div class="history-main">
        <div>
          <b>${escapeHtml(config[entry.type]?.title ?? "Entry")}</b>
          <span>${escapeHtml(entrySummary(entry))}</span>
        </div>
        <time datetime="${escapeHtml(entry.datetime)}">
          ${new Date(entry.datetime).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
          })}
        </time>
      </div>
      <div class="history-actions">
        <button type="button" data-action="edit" data-id="${escapeHtml(entry.id)}">Edit</button>
        <button type="button" data-action="delete" data-id="${escapeHtml(entry.id)}">Delete</button>
      </div>
    </article>
  `).join("");

  container.querySelectorAll('[data-action="edit"]').forEach(button => {
    button.addEventListener("click", () => onEdit(button.dataset.id));
  });

  container.querySelectorAll('[data-action="delete"]').forEach(button => {
    button.addEventListener("click", () => onDelete(button.dataset.id));
  });
}
