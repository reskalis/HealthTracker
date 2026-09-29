function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function dayLabel(date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (sameLocalDay(date, today)) return "Today";
  if (sameLocalDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric"
  });
}

function groupKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function primaryLabel(entry) {
  switch (entry.type) {
    case "measurement": return "Weight";
    case "bp": return "Blood pressure";
    case "workout": return entry.workout_type || "Workout";
    case "daily": return "Daily check-in";
    default: return "Entry";
  }
}

function primaryValue(entry) {
  switch (entry.type) {
    case "measurement":
      return entry.weight_lb ? `${entry.weight_lb} lb` : "Measurement";
    case "bp":
      return entry.systolic && entry.diastolic
        ? `${entry.systolic}/${entry.diastolic}`
        : "Blood pressure";
    case "workout":
      return entry.duration_min ? `${entry.duration_min} min` : "Workout";
    case "daily":
      return entry.sleep_hours ? `${entry.sleep_hours}h sleep` : "Daily check-in";
    default:
      return "Health entry";
  }
}

function detailRows(entry) {
  const rows = [];

  if (entry.type === "measurement" && entry.waist_in) {
    rows.push(["Waist", `${entry.waist_in} in`]);
  }

  if (entry.type === "bp" && entry.pulse) {
    rows.push(["Pulse", `${entry.pulse} bpm`]);
  }

  if (entry.type === "workout") {
    if (entry.intensity) rows.push(["Intensity", entry.intensity]);
    if (entry.workout_type) rows.push(["Type", entry.workout_type]);
  }

  if (entry.type === "daily") {
    if (entry.sleep_quality) rows.push(["Sleep quality", `${entry.sleep_quality}/5`]);
    if (entry.energy) rows.push(["Energy", `${entry.energy}/5`]);
  }

  if (entry.notes) rows.push(["Notes", entry.notes]);

  return rows;
}

function entryMarkup(entry) {
  const date = new Date(entry.datetime);
  const details = detailRows(entry);

  return `
    <details class="history-entry">
      <summary>
        <div class="history-entry-main">
          <span class="history-entry-label">${escapeHtml(primaryLabel(entry))}</span>
          <strong>${escapeHtml(primaryValue(entry))}</strong>
        </div>
        <time datetime="${escapeHtml(entry.datetime)}">
          ${date.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit"
          })}
        </time>
      </summary>

      <div class="history-entry-details">
        ${details.length ? `
          <dl>
            ${details.map(([label, value]) => `
              <div>
                <dt>${escapeHtml(label)}</dt>
                <dd>${escapeHtml(value)}</dd>
              </div>
            `).join("")}
          </dl>
        ` : '<p class="history-no-details">No additional details.</p>'}

        <div class="history-entry-actions">
          <button type="button" data-action="edit" data-id="${escapeHtml(entry.id)}">Edit</button>
          <button type="button" data-action="delete" data-id="${escapeHtml(entry.id)}">Delete</button>
        </div>
      </div>
    </details>
  `;
}

export function renderHistory(container, entries, config, {
  filter = "all",
  limit = 50,
  onEdit = () => {},
  onDelete = () => {},
  onShowOlder = () => {}
} = {}) {
  const filtered = entries
    .filter(entry => filter === "all" || entry.type === filter)
    .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

  if (!filtered.length) {
    container.innerHTML = '<div class="history-empty">No entries in this view yet.</div>';
    return;
  }

  const visible = filtered.slice(0, limit);
  const groups = new Map();

  visible.forEach(entry => {
    const date = new Date(entry.datetime);
    const key = groupKey(date);

    if (!groups.has(key)) {
      groups.set(key, {
        label: dayLabel(date),
        entries: []
      });
    }

    groups.get(key).entries.push(entry);
  });

  container.innerHTML = [
    ...groups.values()
  ].map(group => `
    <section class="history-day">
      <h4>${escapeHtml(group.label)}</h4>
      <div class="history-day-entries">
        ${group.entries.map(entryMarkup).join("")}
      </div>
    </section>
  `).join("") + (
    filtered.length > visible.length
      ? `<button type="button" class="show-older">Show older (${filtered.length - visible.length})</button>`
      : ""
  );

  container.querySelectorAll('[data-action="edit"]').forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      onEdit(button.dataset.id);
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      onDelete(button.dataset.id);
    });
  });

  container.querySelector(".show-older")?.addEventListener("click", onShowOlder);
}
