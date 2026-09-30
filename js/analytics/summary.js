function asNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function average(values) {
  const valid = values.filter(value => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function numericSeries(entries, field) {
  return entries
    .map(entry => asNumber(entry[field]))
    .filter(value => value !== null);
}

function change(values) {
  return values.length > 1 ? values.at(-1) - values[0] : null;
}

/**
 * Returns an inclusive local-day window ending today.
 * The end is tomorrow at local midnight so future-dated records are excluded.
 */
export function rangeBounds(days, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

export function entriesInRange(entries, days, now = new Date()) {
  const { start, end } = rangeBounds(days, now);

  return entries.filter(entry => {
    const date = new Date(entry.datetime);
    return !Number.isNaN(date.getTime()) && date >= start && date < end;
  });
}

export function summarize(entries, days, now = new Date()) {
  const range = entriesInRange(entries, days, now);
  const measurements = range.filter(entry => entry.type === "measurement");
  const bloodPressure = range.filter(entry => entry.type === "bp");
  const workouts = range.filter(entry => entry.type === "workout");
  const daily = range.filter(entry => entry.type === "daily");

  const weights = numericSeries(measurements, "weight_lb");
  const waists = numericSeries(measurements, "waist_in");
  const systolic = numericSeries(bloodPressure, "systolic");
  const diastolic = numericSeries(bloodPressure, "diastolic");
  const pulse = numericSeries(bloodPressure, "pulse");
  const sleep = numericSeries(daily, "sleep_hours");
  const energy = numericSeries(daily, "energy");
  const sleepQuality = numericSeries(daily, "sleep_quality");

  const latestBp = bloodPressure.at(-1) ?? null;
  const latestWorkout = workouts.at(-1) ?? null;

  return {
    days,
    recordCount: range.length,

    latestWeight: weights.at(-1) ?? null,
    weightChange: change(weights),
    latestWaist: waists.at(-1) ?? null,
    waistChange: change(waists),

    avgSystolic: average(systolic),
    avgDiastolic: average(diastolic),
    avgPulse: average(pulse),
    latestSystolic: latestBp ? asNumber(latestBp.systolic) : null,
    latestDiastolic: latestBp ? asNumber(latestBp.diastolic) : null,
    latestPulse: latestBp ? asNumber(latestBp.pulse) : null,

    workoutCount: workouts.length,
    workoutMinutes: workouts.reduce(
      (sum, entry) => sum + (asNumber(entry.duration_min) ?? 0),
      0
    ),
    latestWorkoutType: latestWorkout?.workout_type ?? null,

    avgSleep: average(sleep),
    avgEnergy: average(energy),
    avgSleepQuality: average(sleepQuality)
  };
}

export function buildTrendSeries(entries, days, now = new Date()) {
  const range = entriesInRange(entries, days, now);

  const sortByDate = items => [...items].sort(
    (a, b) => new Date(a.datetime) - new Date(b.datetime)
  );

  const series = (type, field) =>
    sortByDate(
      range.filter(entry => entry.type === type && asNumber(entry[field]) !== null)
    ).map(entry => ({
      date: entry.datetime,
      value: asNumber(entry[field])
    }));

  return {
    weight: series("measurement", "weight_lb"),
    systolic: series("bp", "systolic"),
    diastolic: series("bp", "diastolic"),
    sleep: series("daily", "sleep_hours")
  };
}
