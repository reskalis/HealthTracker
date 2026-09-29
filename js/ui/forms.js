function escapeAttribute(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function attributes(field) {
  return [
    field.inputMode && `inputmode="${field.inputMode}"`,
    field.step && `step="${field.step}"`,
    field.min !== undefined && `min="${field.min}"`,
    field.max !== undefined && `max="${field.max}"`,
    field.required && "required"
  ].filter(Boolean).join(" ");
}

export function renderFields(fields, values = {}) {
  return fields.map(field => {
    const currentValue = values[field.name] ?? "";

    if (field.type === "select") {
      const options = field.options.map(option => {
        const selected = String(option.value) === String(currentValue) ? " selected" : "";
        return `<option value="${escapeAttribute(option.value)}"${selected}>${option.label}</option>`;
      }).join("");

      return `
        <div class="field">
          <label for="${field.name}">${field.label}</label>
          <select id="${field.name}" name="${field.name}" ${field.required ? "required" : ""}>
            ${options}
          </select>
        </div>
      `;
    }

    return `
      <div class="field">
        <label for="${field.name}">${field.label}</label>
        <input
          id="${field.name}"
          name="${field.name}"
          type="${field.type}"
          value="${escapeAttribute(currentValue)}"
          ${attributes(field)}
        >
      </div>
    `;
  }).join("");
}
