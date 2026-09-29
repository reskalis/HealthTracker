function attributes(field) {
  return [
    field.inputMode && `inputmode="${field.inputMode}"`,
    field.step && `step="${field.step}"`,
    field.min !== undefined && `min="${field.min}"`,
    field.max !== undefined && `max="${field.max}"`,
    field.required && "required"
  ].filter(Boolean).join(" ");
}

export function renderFields(fields) {
  return fields.map(field => {
    if (field.type === "select") {
      const options = field.options.map(option => `<option value="${option.value}">${option.label}</option>`).join("");
      return `<div class="field"><label for="${field.name}">${field.label}</label><select id="${field.name}" name="${field.name}" ${field.required ? "required" : ""}>${options}</select></div>`;
    }
    return `<div class="field"><label for="${field.name}">${field.label}</label><input id="${field.name}" name="${field.name}" type="${field.type}" ${attributes(field)}></div>`;
  }).join("");
}
