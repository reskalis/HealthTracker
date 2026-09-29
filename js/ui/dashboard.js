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

function pointPath(points, width, height, padding, min, max) {
  if (!points.length) return "";
  const span = max - min || 1;
  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  return points.map((point, index) => {
    const x = points.length > 1 ? padding + index * xStep : width / 2;
    const y = height - padding - ((point.value - min) / span) * (height - padding * 2);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function lineChart(title, series, suffix = "") {
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
  let min = Math.min(...allValues);
  let max = Math.max(...allValues);

  if (min === max) {
    min -= 1;
    max += 1;
  } else {
    const margin = (max - min) * 0.12;
    min -= margin;
    max += margin;
  }

  const width = 320;
  const height = 150;
  const padding = 18;
  const paths = usable.map((item, index) => `
    <path class="chart-line chart-line-${index + 1}"
      d="${pointPath(item.points, width, height, padding, min, max)}"
      vector-effect="non-scaling-stroke" />
  `).join("");

  const latest = usable.map(item => {
    const point = item.points.at(-1);
    return `${item.label} ${formatNumber(point.value)}${suffix}`;
  }).join(" • ");

  return `
    <article class="chart-card">
      <div class="chart-header"><strong>${title}</strong><span>${latest}</span></div>
      <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title} trend">
        <line class="chart-gridline" x1="18" y1="132" x2="302" y2="132"></line>
        <line class="chart-gridline" x1="18" y1="18" x2="302" y2="18"></line>
        ${paths}
      </svg>
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
    lineChart("Weight", [{ label: "Latest", points: trends.weight }], " lb"),
    lineChart("Blood pressure", [
      { label: "Sys", points: trends.systolic },
      { label: "Dia", points: trends.diastolic }
    ]),
    lineChart("Sleep", [{ label: "Sleep", points: trends.sleep }], " h"),
    lineChart("Energy", [{ label: "Energy", points: trends.energy }], "/5")
  ].join("");
}
