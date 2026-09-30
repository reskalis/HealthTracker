import test from "node:test";
import assert from "node:assert/strict";

import {
  rangeBounds,
  entriesInRange,
  summarize,
  buildTrendSeries
} from "../js/analytics/summary.js";

const NOW = new Date("2026-09-30T12:00:00-04:00");

function entry(id, type, datetime, fields = {}) {
  return { id, type, datetime, ...fields };
}

test("1D range is the current local calendar day", () => {
  const { start, end } = rangeBounds(1, NOW);

  assert.equal(start.getFullYear(), 2026);
  assert.equal(start.getMonth(), 8);
  assert.equal(start.getDate(), 30);
  assert.equal(start.getHours(), 0);

  assert.equal(end.getFullYear(), 2026);
  assert.equal(end.getMonth(), 9);
  assert.equal(end.getDate(), 1);
  assert.equal(end.getHours(), 0);
});

test("7D range includes today plus the previous six local days", () => {
  const { start, end } = rangeBounds(7, NOW);

  assert.equal(start.getFullYear(), 2026);
  assert.equal(start.getMonth(), 8);
  assert.equal(start.getDate(), 24);
  assert.equal(end.getDate(), 1);
});

test("future-dated entries are excluded from all current ranges", () => {
  const entries = [
    entry("today", "workout", "2026-09-30T15:00:00-04:00", {
      workout_type: "BJJ",
      duration_min: "60",
      intensity: "Hard"
    }),
    entry("future", "workout", "2026-10-01T09:00:00-04:00", {
      workout_type: "Strength",
      duration_min: "45",
      intensity: "Moderate"
    })
  ];

  assert.deepEqual(
    entriesInRange(entries, 30, NOW).map(item => item.id),
    ["today"]
  );
});

test("workout summary counts records and totals minutes in range", () => {
  const entries = [
    entry("w1", "workout", "2026-09-30T08:00:00-04:00", {
      workout_type: "BJJ",
      duration_min: "60",
      intensity: "Hard"
    }),
    entry("w2", "workout", "2026-09-30T18:00:00-04:00", {
      workout_type: "Strength",
      duration_min: "30",
      intensity: "Moderate"
    })
  ];

  const stats = summarize(entries, 1, NOW);
  assert.equal(stats.workoutCount, 2);
  assert.equal(stats.workoutMinutes, 90);
  assert.equal(stats.latestWorkoutType, "Strength");
});

test("blank optional numeric fields do not become zero", () => {
  const entries = [
    entry("m1", "measurement", "2026-09-30T08:00:00-04:00", {
      weight_lb: "200",
      waist_in: ""
    })
  ];

  const stats = summarize(entries, 1, NOW);
  assert.equal(stats.latestWeight, 200);
  assert.equal(stats.latestWaist, null);
});

test("summary math is chronological and descriptive", () => {
  const entries = [
    entry("m1", "measurement", "2026-09-29T08:00:00-04:00", {
      weight_lb: "201"
    }),
    entry("m2", "measurement", "2026-09-30T08:00:00-04:00", {
      weight_lb: "199"
    }),
    entry("d1", "daily", "2026-09-30T09:00:00-04:00", {
      sleep_hours: "8",
      sleep_quality: "4",
      energy: "3"
    }),
    entry("bp1", "bp", "2026-09-30T10:00:00-04:00", {
      systolic: "120",
      diastolic: "80",
      pulse: "60"
    })
  ];

  const stats = summarize(entries, 7, NOW);
  assert.equal(stats.latestWeight, 199);
  assert.equal(stats.weightChange, -2);
  assert.equal(stats.avgSleep, 8);
  assert.equal(stats.avgSystolic, 120);
  assert.equal(stats.avgDiastolic, 80);
});

test("trend series are sorted by timestamp", () => {
  const entries = [
    entry("late", "measurement", "2026-09-30T18:00:00-04:00", {
      weight_lb: "199"
    }),
    entry("early", "measurement", "2026-09-30T08:00:00-04:00", {
      weight_lb: "200"
    })
  ];

  const trends = buildTrendSeries(entries, 1, NOW);
  assert.deepEqual(trends.weight.map(point => point.value), [200, 199]);
});
