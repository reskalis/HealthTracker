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
4. Confirm each record appears under **History** and the type filters work.
5. Edit one dummy record and confirm the change persists after reload.
6. Delete one dummy record and confirm only that record is removed.
7. Check the 1D, 7D, 30D, and 90D trend ranges.
8. Tap chart points and confirm the value/time readout updates.
9. Expand History, verify date grouping, expand an individual row, and test the type filter.
10. Export `healthtracker_backup.csv`.
11. Confirm the file contains all records and the expected backup schema version.
12. Open Restore and confirm the preview shows filename, record count, date range, type counts, and replacement warning before any data changes.
13. Cancel the restore and confirm current records remain unchanged.
14. Restore the valid backup and verify the record count matches.
15. Try restoring a deliberately malformed backup and confirm it is rejected without changing current records.
16. Confirm a duplicate-ID backup, malformed-date backup, and unknown-type backup are each rejected.
17. Confirm the backup reminder appears when appropriate, can be snoozed, and clears after a successful export.
18. Open **Data & app status → Data management**, verify deletion requires typing `DELETE`, then cancel without deleting.
19. Reload the app and confirm records remain.
20. Put the device offline, reopen HealthTracker, and confirm the app loads and records remain available.
21. Return online and verify the network status updates.

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
