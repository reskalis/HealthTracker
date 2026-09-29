# HealthTracker release checklist

Use this checklist before treating a deployment as ready for real health data.

## Versioning
- Update `APP_VERSION` for user-facing releases.
- Update `BUILD_ID` for every deployed build.
- Increment `DB_SCHEMA_VERSION` only for IndexedDB structure changes.
- Increment `BACKUP_SCHEMA_VERSION` only for portable CSV format changes.
- Keep the service-worker cache release ID aligned with the build.

## Smoke test
1. Open HealthTracker online.
2. Confirm **Data & app status** shows the expected app, database, and backup versions.
3. Create one dummy record of each type.
4. Confirm each record appears under **Recent**.
5. Export `healthtracker_backup.csv`.
6. Confirm the file contains all records and the expected backup schema version.
7. Restore that backup and verify the record count matches.
8. Reload the app and confirm records remain.
9. Put the device offline, reopen HealthTracker, and confirm the app loads and records remain available.
10. Return online and verify the network status updates.

## Update test
1. Deploy a build with a new build ID and service-worker cache release ID.
2. Reopen or focus the previously installed app.
3. Confirm the **Reload to update** banner appears.
4. Choose **Reload to update**.
5. Confirm the new build ID is shown under **Data & app status**.
6. Confirm existing health records are unchanged.

## Privacy check
- No health backup files are committed to the public repository.
- No analytics, advertising, external health-data API, or account service has been added.
- Application cache changes do not delete or migrate IndexedDB unless a documented database migration requires it.
