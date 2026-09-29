function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function average(values) {
  const valid = values.filter(value => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function cutoffForDays(days) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return cutoff;
}

export function entriesInRange(entries, days) {
  const cutoff = cutoffForDays(days);
  return entries.filter(entry => {
    const date = new Date(entry.datetime);
    return !Number.isNaN(date.getTime()) && date >= cutoff;
  });
}

export function summarize(entries, days) {
  const range = entriesInRange(entries, days);
  const measurements = range.filter(entry => entry.type === "measurement" && asNumber(entry.weight_lb) !== null);
  const bloodPressure = range.filter(entry => entry.type === "bp");
  const workouts = range.filter(entry => entry.type === "workout");
  const daily = range.filter(entry => entry.type === "daily");

  const weights = measurements.map(entry => asNumber(entry.weight_lb)).filter(value => value !== null);
  const firstWeight = weights[0] ?? null;
  const latestWeight = weights.at(-1) ?? null;
  const weightChange = firstWeight !== null && latestWeight !== null && weights.length > 1
    ? latestWeight - firstWeight
    : null;

  const avgSystolic = average(bloodPressure.map(entry => asNumber(entry.systolic)).filter(value => value !== null));
  const avgDiastolic = average(bloodPressure.map(entry => asNumber(entry.diastolic)).filter(value => value !== null));
  const workoutMinutes = workouts.reduce((sum, entry) => sum + (asNumber(entry.duration_min) ?? 0), 0);
  const avgSleep = average(daily.map(entry => asNumber(entry.sleep_hours)).filter(value => value !== null));
  const avgEnergy = average(daily.map(entry => asNumber(entry.energy)).filter(value => value !== null));

  return {
    days,
    recordCount: range.length,
    latestWeight,
    weightChange,
    avgSystolic,
    avgDiastolic,
    workoutCount: workouts.length,
    workoutMinutes,
    avgSleep,
    avgEnergy
  };
}

export function buildTrendSeries(entries, days) {
  const range = entriesInRange(entries, days);

  const sortByDate = items => [...items].sort(
    (a, b) => new Date(a.datetime) - new Date(b.datetime)
  );

  return {
    weight: sortByDate(range.filter(entry => entry.type === "measurement" && asNumber(entry.weight_lb) !== null))
      .map(entry => ({ date: entry.datetime, value: asNumber(entry.weight_lb) })),
    systolic: sortByDate(range.filter(entry => entry.type === "bp" && asNumber(entry.systolic) !== null))
      .map(entry => ({ date: entry.datetime, value: asNumber(entry.systolic) })),
    diastolic: sortByDate(range.filter(entry => entry.type === "bp" && asNumber(entry.diastolic) !== null))
      .map(entry => ({ date: entry.datetime, value: asNumber(entry.diastolic) })),
    sleep: sortByDate(range.filter(entry => entry.type === "daily" && asNumber(entry.sleep_hours) !== null))
      .map(entry => ({ date: entry.datetime, value: asNumber(entry.sleep_hours) })),
    energy: sortByDate(range.filter(entry => entry.type === "daily" && asNumber(entry.energy) !== null))
      .map(entry => ({ date: entry.datetime, value: asNumber(entry.energy) }))
  };
}
