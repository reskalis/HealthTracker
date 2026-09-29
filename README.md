# HealthTracker

A privacy-first, local-first personal health tracking Progressive Web App.

## Privacy model
Health records are stored on the user's device in IndexedDB. There is no account, analytics SDK, advertising, health-data API, or application backend. GitHub Pages serves application code only. Never commit personal health exports or backup files to this public repository.

## Architecture
- `index.html` — application shell
- `css/` — design tokens, base rules, and components
- `js/config/forms.js` — declarative fields and validation
- `js/db/database.js` — IndexedDB persistence and legacy migration
- `js/data/` — CSV import/export
- `js/ui/` — presentation modules
- `js/app.js` — application orchestration
- `docs/DATA_SCHEMA.md` — record schema
- `sw.js` — offline cache

## Data safety
The working database is local to the browser/PWA. The portable backup is `healthtracker_backup.csv`. The UI records successful exports and can restore a backup. Browser/site data should never be the only long-term copy.

## Development
The app intentionally uses vanilla HTML, CSS, and JavaScript with no runtime dependencies, build process, external CDN, analytics, or network API.

To add a health metric:
1. Define the field and validation in `js/config/forms.js`.
2. Document it in `docs/DATA_SCHEMA.md`.
3. Add its portable column to `CSV_COLUMNS` in `js/data/export.js`.
4. Update presentation independently of persistence.

## Deployment
GitHub Pages deploys the default branch from the repository root. Relative URLs keep the PWA compatible with the `/HealthTracker/` project path.
