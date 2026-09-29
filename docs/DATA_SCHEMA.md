# HealthTracker data schema

HealthTracker stores one record per health event. Every internal record has a UUID `id`, an ISO-8601 `datetime`, a `type`, and creation/update timestamps. CSV backups intentionally contain the portable health fields rather than internal database metadata.

## Record types

### daily
- sleep_hours: decimal hours, 0–24
- sleep_quality: integer scale 1–5
- energy: integer scale 1–5
- notes: optional text

### measurement
- weight_lb: decimal pounds
- waist_in: optional decimal inches

### bp
- systolic: integer mmHg
- diastolic: integer mmHg
- pulse: integer bpm

### workout
- workout_type: BJJ, Strength, Cardio, Walking / Hiking, Mobility, or Other
- duration_min: integer minutes
- intensity: Easy, Moderate, Hard, or Very Hard
- notes: optional text

## CSV backup columns

`datetime,type,sleep_hours,sleep_quality,energy,weight_lb,waist_in,systolic,diastolic,pulse,workout_type,duration_min,intensity,notes`

The CSV format is designed to remain easy to inspect in a spreadsheet and easy to analyze outside the app.

## Database versioning

IndexedDB database: `HealthTracker`
Current schema version: 1
Object store: `entries`

Future schema changes should increment `DB_VERSION` in `js/db/database.js` and perform migrations in `onupgradeneeded`.
