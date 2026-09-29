export const FORM_CONFIG = {
  daily: {
    title: "Daily check-in",
    fields: [
      { name: "sleep_hours", label: "Sleep (hours)", type: "number", inputMode: "decimal", step: 0.1, min: 0, max: 24, required: true },
      { name: "sleep_quality", label: "Sleep quality", type: "select", required: true, options: [
        { value: "1", label: "1 — Very poor" }, { value: "2", label: "2 — Poor" }, { value: "3", label: "3 — Okay" },
        { value: "4", label: "4 — Good" }, { value: "5", label: "5 — Excellent" }
      ]},
      { name: "energy", label: "Energy", type: "select", required: true, options: [
        { value: "1", label: "1 — Very low" }, { value: "2", label: "2 — Low" }, { value: "3", label: "3 — Okay" },
        { value: "4", label: "4 — Good" }, { value: "5", label: "5 — High" }
      ]},
      { name: "notes", label: "Notes (optional)", type: "text", required: false }
    ]
  },
  measurement: {
    title: "Weight & waist",
    fields: [
      { name: "weight_lb", label: "Weight (lb)", type: "number", inputMode: "decimal", step: 0.1, min: 1, max: 1500, required: true },
      { name: "waist_in", label: "Waist (in, optional)", type: "number", inputMode: "decimal", step: 0.1, min: 1, max: 150, required: false }
    ]
  },
  bp: {
    title: "Blood pressure",
    fields: [
      { name: "systolic", label: "Systolic", type: "number", inputMode: "numeric", step: 1, min: 50, max: 300, required: true },
      { name: "diastolic", label: "Diastolic", type: "number", inputMode: "numeric", step: 1, min: 30, max: 200, required: true },
      { name: "pulse", label: "Pulse (bpm)", type: "number", inputMode: "numeric", step: 1, min: 20, max: 300, required: true }
    ]
  },
  workout: {
    title: "Workout",
    fields: [
      { name: "workout_type", label: "Workout type", type: "select", required: true, options: ["BJJ", "Strength", "Cardio", "Walking / Hiking", "Mobility", "Other"].map(value => ({ value, label: value })) },
      { name: "duration_min", label: "Duration (minutes)", type: "number", inputMode: "numeric", step: 1, min: 1, max: 1440, required: true },
      { name: "intensity", label: "Intensity", type: "select", required: true, options: ["Easy", "Moderate", "Hard", "Very Hard"].map(value => ({ value, label: value })) },
      { name: "notes", label: "Notes (optional)", type: "text", required: false }
    ]
  }
};
