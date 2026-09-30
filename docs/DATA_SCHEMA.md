# HealthTracker data schema

HealthTracker stores one record per health event. Every internal record has a UUID `id`, an ISO-8601 `datetime`, a `type`, and creation/update timestamps.

## Versioning

HealthTracker versions three things independently:

- App version: `0.6.0`
- IndexedDB schema version: `1`
- CSV backup schema version: `2`

The canonical values live in `js/config/version.js`.

## Record types

### daily
- `sleep_hours`: decimal hours, 0–24
- `sleep_quality`: integer scale 1–5
- `energy`: integer scale 1–5
- `notes`: optional text

### measurement
- `weight_lb`: decimal pounds
- `waist_in`: optional decimal inches

### bp
- `systolic`: integer mmHg
- `diastolic`: integer mmHg
- `pulse`: integer bpm

### workout
- `workout_type`: BJJ, Strength, Cardio, Walking / Hiking, Mobility, or Other
- `duration_min`: integer minutes
- `intensity`: Easy, Moderate, Hard, or Very Hard
- `notes`: optional text

## CSV backup schema v2

The portable backup keeps a stable record ID and includes explicit format metadata.

Columns:

`id,datetime,type,sleep_hours,sleep_quality,energy,weight_lb,waist_in,systolic,diastolic,pulse,workout_type,duration_min,intensity,notes,backup_schema_version,app_version`

`backup_schema_version` and `app_version` are export metadata. They are not stored as health fields when a backup is restored.

Older backups without these metadata columns remain importable. Backups made by a future unsupported schema are rejected rather than silently misread.

## Restore validation

A restore is validated completely before IndexedDB is modified. HealthTracker rejects backups with:

- missing, duplicate, empty, or unsupported column names
- malformed CSV quoting or inconsistent row lengths
- missing or malformed date/time values
- unknown record types
- duplicate record IDs
- missing required fields
- non-numeric or out-of-range numeric fields
- unsupported select values
- invalid, mixed, or future backup schema versions

Compatible legacy backups without stable IDs receive generated UUIDs during inspection. Restore remains an atomic replacement operation, so a failed validation cannot partially overwrite the current database.

## Database versioning

IndexedDB database: `HealthTracker`  
Current schema version: `1`  
Object store: `entries`

Future structural database changes must increment `DB_SCHEMA_VERSION` and `DB_VERSION` together and perform the migration inside `onupgradeneeded`.
