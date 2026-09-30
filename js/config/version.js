/**
 * Release metadata.
 *
 * Keep app, database, and backup schema versions separate:
 * - APP_VERSION changes for user-facing releases.
 * - DB_SCHEMA_VERSION changes only when IndexedDB structure changes.
 * - BACKUP_SCHEMA_VERSION changes only when the portable CSV format changes.
 */
export const APP_VERSION = "0.6.2";
export const BUILD_ID = "2026-09-30.5";
export const DB_SCHEMA_VERSION = 1;
export const BACKUP_SCHEMA_VERSION = 2;
