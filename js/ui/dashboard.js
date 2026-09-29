import { summarize, buildTrendSeries } from "../analytics/summary.js";

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(digits).replace(/\.0$/, "");
}

function signed(value, unit = "") {
  if (value === null || value === undefined) return "Not enough data";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumber(value)}${unit}`;
}

function summaryCard(label, value, detail) {
  return `
    <article class="summary-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${detail}</small>
    </article>
  `;
}

function timeBounds(series) {
  const times = series.flatMap(item =>
    item.points
      .map(point => new Date(point.date).getTime())
      .filter(Number.isFinite)
  );

  if (!times.length) return null;

  return {
    min: Math.min(...times),
    max: Math.max(...times)
  };
}

function pointPath(points, width, height, padding, minValue, maxValue, minTime, maxTime) {
  if (!points.length) return "";

  const valueSpan = maxValue - minValue || 1;
  const timeSpan = maxTime - minTime || 1;

  return points.map((point, index) => {
    const time = new Date(point.date).getTime();
    const x = points.length === 1
      ? width / 2
      : padding + ((time - minTime) / timeSpan) * (width - padding * 2);

    const y = height - padding -
      ((point.value - minValue) / valueSpan) * (height - padding * 2);

    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function axisLabel(timestamp, days) {
  const date = new Date(timestamp);

  return days === 1
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function lineChart(title, series, days, suffix = "") {
  const usable = series.filter(item => item.points.length);

  if (!usable.length) {
    return `
      <article class="chart-card">
        <div class="chart-header"><strong>${title}</strong><span>No data in this range</span></div>
        <div class="chart-empty">Log a few entries to see a trend.</div>
      </article>
    `;
  }

  const allValues = usable.flatMap(item => item.points.map(point => point.value));
  let minValue = Math.min(...allValues);
  let maxValue = Math.max(...allValues);

  if (minValue === maxValue) {
    minValue -= 1;
    maxValue += 1;
  } else {
    const margin = (maxValue - minValue) * 0.12;
    minValue -= margin;
    maxValue += margin;
  }

  const bounds = timeBounds(usable);
  const minTime = bounds?.min ?? Date.now();
  const maxTime = bounds?.max ?? minTime + 1;

  const width = 320;
  const height = 150;
  const padding = 18;

  const paths = usable.map((item, index) => {
    const path = `
      <path class="chart-line chart-line-${index + 1}"
        d="${pointPath(item.points, width, height, padding, minValue, maxValue, minTime, maxTime)}"
        vector-effect="non-scaling-stroke" />
    `;

    const singlePoint = item.points.length === 1
      ? `<circle class="chart-dot chart-dot-${index + 1}" cx="${width / 2}" cy="${height / 2}" r="4"></circle>`
      : "";

    return path + singlePoint;
  }).join("");

  const latest = usable.map(item => {
    const point = item.points.at(-1);
    return `${item.label} ${formatNumber(point.value)}${suffix}`;
  }).join(" • ");

  const startLabel = axisLabel(minTime, days);
  const endLabel = axisLabel(maxTime, days);

  return `
    <article class="chart-card">
      <div class="chart-header"><strong>${title}</strong><span>${latest}</span></div>
      <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title} trend">
        <line class="chart-gridline" x1="18" y1="132" x2="302" y2="132"></line>
        <line class="chart-gridline" x1="18" y1="18" x2="302" y2="18"></line>
        ${paths}
      </svg>
      <div class="chart-axis"><span>${startLabel}</span><span>${endLabel}</span></div>
    </article>
  `;
}

export function renderDashboard(summaryContainer, chartContainer, entries, days) {
  const stats = summarize(entries, days);
  const trends = buildTrendSeries(entries, days);

  summaryContainer.innerHTML = [
    summaryCard(
      "Weight",
      stats.latestWeight === null ? "—" : formatNumber(stats.latestWeight) + " lb",
      stats.weightChange === null ? "Need 2+ measurements" : signed(stats.weightChange, " lb")
    ),
    summaryCard(
      "Average BP",
      stats.avgSystolic === null || stats.avgDiastolic === null
        ? "—"
        : Math.round(stats.avgSystolic) + "/" + Math.round(stats.avgDiastolic),
      stats.avgSystolic === null ? "No readings" : "Across this range"
    ),
    summaryCard(
      "Workouts",
      String(stats.workoutCount),
      stats.workoutMinutes + " total min"
    ),
    summaryCard(
      "Sleep",
      stats.avgSleep === null ? "—" : formatNumber(stats.avgSleep) + " h",
      stats.avgEnergy === null ? "No check-ins" : "Avg energy " + formatNumber(stats.avgEnergy) + "/5"
    )
  ].join("");

  chartContainer.innerHTML = [
    lineChart("Weight", [{ label: "Latest", points: trends.weight }], days, " lb"),
    lineChart("Blood pressure", [
      { label: "Sys", points: trends.systolic },
      { label: "Dia", points: trends.diastolic }
    ], days),
    lineChart("Sleep", [{ label: "Sleep", points: trends.sleep }], days, " h"),
    lineChart("Energy", [{ label: "Energy", points: trends.energy }], days, "/5")
  ].join("");
}
