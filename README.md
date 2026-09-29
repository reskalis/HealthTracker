# HealthTracker

A privacy-first, local-first personal health tracking Progressive Web App.

## Privacy model

Health records are stored locally in the browser using IndexedDB. The public GitHub repository and GitHub Pages deployment contain application code only. HealthTracker has no account system, advertising, analytics, or health-data backend.

**Do not commit personal CSV exports or backup files to this repository.** The included `.gitignore` blocks common backup paths and CSV files as an additional safeguard.

## Current features

- Daily check-in: sleep duration, sleep quality, energy, notes
- Weight and waist measurements
- Blood pressure and pulse
- Workout logging
- IndexedDB local storage
- Automatic migration from the prototype localStorage database
- CSV export
- CSV import/restore
- Offline PWA application shell
- Numeric mobile keyboards and field-level input constraints

## Architecture

```
HealthTracker/
├── index.html
├── manifest.webmanifest
├── sw.js
├── css/
│   └── app.css
├── js/
│   ├── app.js
│   ├── config/forms.js
│   ├── db/database.js
│   ├── data/csv.js
│   ├── data/export.js
│   └── ui/
│       ├── forms.js
│       └── history.js
└── docs/
    └── DATA_SCHEMA.md
```

The modules deliberately separate form configuration, persistence, portable data formats, UI rendering, and application orchestration.

## Adding a health field

1. Add the field definition to `js/config/forms.js`.
2. Add its portable column name to `CSV_COLUMNS` in `js/data/csv.js`.
3. Update the relevant display summary in `js/ui/history.js`.
4. Document the field in `docs/DATA_SCHEMA.md`.
5. Test entry, refresh persistence, export, import, and offline behavior.

## Storage and migrations

The current IndexedDB schema version is documented in `docs/DATA_SCHEMA.md`. Any database schema change should increment the database version and include an explicit migration. Existing prototype data in `localStorage["healthtracker.v1"]` is migrated automatically on startup.

## Deployment

The app is static and is designed for GitHub Pages. All asset paths are relative so it can run under the repository's `/HealthTracker/` path.

## Development principles

Prefer readable, explicit code over clever abstractions. Keep health data local. Avoid runtime third-party dependencies unless there is a compelling reason. Treat export/import compatibility as a stable public data interface.
