import test from "node:test";
import assert from "node:assert/strict";

import {
  BACKUP_REMINDER_DAYS,
  BACKUP_SNOOZE_HOURS,
  getBackupReminderState,
  snoozeUntil
} from "../js/ui/data-safety.js";

const NOW = new Date("2026-09-30T12:00:00.000Z");

test("no records means no backup reminder", () => {
  assert.deepEqual(
    getBackupReminderState({
      recordCount: 0,
      lastBackup: null,
      dismissedUntil: null,
      now: NOW
    }),
    { show: false }
  );
});

test("records with no known backup trigger a reminder", () => {
  const state = getBackupReminderState({
    recordCount: 3,
    lastBackup: null,
    dismissedUntil: null,
    now: NOW
  });

  assert.equal(state.show, true);
  assert.match(state.message, /3 local records/);
});

test("recent backup does not trigger a reminder", () => {
  const recent = new Date(
    NOW.getTime() - (BACKUP_REMINDER_DAYS - 1) * 24 * 60 * 60 * 1000
  ).toISOString();

  assert.deepEqual(
    getBackupReminderState({
      recordCount: 2,
      lastBackup: recent,
      dismissedUntil: null,
      now: NOW
    }),
    { show: false }
  );
});

test("backup at reminder threshold triggers a reminder", () => {
  const old = new Date(
    NOW.getTime() - BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const state = getBackupReminderState({
    recordCount: 2,
    lastBackup: old,
    dismissedUntil: null,
    now: NOW
  });

  assert.equal(state.show, true);
  assert.match(state.message, /7 days ago/);
});

test("active snooze suppresses the reminder", () => {
  const future = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();

  assert.deepEqual(
    getBackupReminderState({
      recordCount: 2,
      lastBackup: null,
      dismissedUntil: future,
      now: NOW
    }),
    { show: false }
  );
});

test("snooze duration is exactly configured hours", () => {
  const snoozed = new Date(snoozeUntil(NOW));
  assert.equal(
    snoozed.getTime() - NOW.getTime(),
    BACKUP_SNOOZE_HOURS * 60 * 60 * 1000
  );
});
