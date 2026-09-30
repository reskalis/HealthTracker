# HealthTracker

A privacy-first, local-first personal health tracking Progressive Web App.

## Privacy model

Health records are stored on the user's device in IndexedDB. There is no account, analytics SDK, advertising, health-data API, or application backend. GitHub Pages serves application code only.

**Never commit personal health exports or backup files to this public repository.**

## Architecture

- `index.html` — semantic application shell
- `css/` — design tokens, base styles, and components
- `js/config/forms.js` — declarative field definitions and validation
- `js/config/version.js` — app/database/backup version metadata
- `js/analytics/summary.js` — local descriptive trend calculations
- `js/db/database.js` — IndexedDB persistence and migrations
- `js/data/` — portable CSV serialization, strict backup inspection, restore validation, and export
- `js/pwa/update.js` — service-worker registration and update UX
- `js/ui/` — forms, dashboard, history, status, and presentation modules
- `js/app.js` — application orchestration
- `docs/DATA_SCHEMA.md` — canonical data and backup schema
- `sw.js` — offline cache and update strategy

## Data safety

The working database is local to the browser/PWA. The portable backup is `healthtracker_backup.csv`.

HealthTracker reminds the user to export when local records have no known backup or the last backup is at least 7 days old. The reminder can be snoozed for 24 hours and never transmits data.

Restore is an explicit replacement operation. Before the database is touched, the entire CSV is inspected for malformed structure, duplicate IDs, invalid dates, unsupported record types, invalid required values, unsupported columns, mixed/future backup schemas, and other incompatible data. A restore preview shows the file, record count, date range, record-type counts, and how many current local records will be replaced.

A deliberately buried **Data management** control allows all local health records to be deleted. Deletion requires typing `DELETE` and does not affect CSV backups previously exported outside the app.

Browser/site data should never be the only long-term copy.

## Versioning

HealthTracker keeps three versions separate:

- App version — user-facing software release
- Database schema version — IndexedDB structure
- Backup schema version — portable CSV format

The current values are defined in `js/config/version.js` and surfaced in the app under **Data & app status**.

## Trends and history

Trend summaries are calculated entirely on-device from IndexedDB records. HealthTracker supports 1-, 7-, 30-, and 90-day descriptive views. Each metric is presented as one readable card so the headline number, context, and chart stay together.

- Weight includes latest weight, change in range, and waist context.
- Blood pressure includes the range average, latest reading, pulse context, and systolic/diastolic chart.
- Sleep includes average sleep, sleep-quality/energy context, and a time-scaled trend.
- Activity stays intentionally compact with workout count and total minutes rather than forcing event data into a line graph.
- Chart points can be tapped to inspect the specific value and timestamp.

History is collapsed by default, filterable by record type, grouped by date, and rendered as compact expandable rows. Edit/Delete controls and secondary details only appear after expanding an entry. The first 50 matching records render initially, with older records available on demand. Editing preserves the record UUID and original creation timestamp while updating the health fields, event date/time, and `updated_at` timestamp.

## PWA update strategy

HealthTracker is offline-capable without silently trapping users on stale code.

- The service worker precaches the current application shell.
- App assets use a network-first strategy with a cached offline fallback.
- Network requests bypass the browser HTTP cache when checking app code.
- A newly installed service worker waits instead of replacing the running app mid-session.
- When an update is ready, the UI shows **Reload to update**.
- Obsolete HealthTracker caches are deleted when the new worker activates.
- IndexedDB health records are independent from application caches and are never cleared during an app update.

## Development

The app intentionally uses vanilla HTML, CSS, and JavaScript with no runtime dependencies, build process, external CDN, analytics, or network API.

To add a health metric:

1. Define the field and validation in `js/config/forms.js`.
2. Document it in `docs/DATA_SCHEMA.md`.
3. Add its portable column to `CSV_COLUMNS` in `js/data/csv.js`.
4. Update presentation independently of persistence.
5. Increment the appropriate schema version only when the stored or portable format actually changes.

For every user-facing release, increment `APP_VERSION`, update `BUILD_ID`, and keep the service-worker cache version aligned with the app release.

## Deployment

GitHub Pages deploys the default branch from the repository root. Relative URLs keep the PWA compatible with the `/HealthTracker/` project path.
