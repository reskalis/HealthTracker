import { summarize, buildTrendSeries, rangeBounds } from "../analytics/summary.js";

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(digits).replace(/\.0$/, "");
}

function formatChange(value, unit) {
  if (value === null || value === undefined) return null;
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumber(value)}${unit}`;
}

function formatPointDate(isoString, days) {
  const date = new Date(isoString);
  return days === 1
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function axisDate(timestamp, days) {
  const date = new Date(timestamp);
  return days === 1
    ? date.toLocaleTimeString(undefined, { hour: "numeric" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function chartGeometry(series, days) {
  const usable = series.filter(item => item.points.length);
  if (!usable.length) return null;

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

  const { start, end } = rangeBounds(days);

  return {
    usable,
    minValue,
    maxValue,
    minTime: start.getTime(),
    maxTime: end.getTime() - 1
  };
}

function pointPosition(point, geometry) {
  const width = 320;
  const height = 148;
  const left = 40;
  const right = 12;
  const top = 16;
  const bottom = 24;

  const time = new Date(point.date).getTime();
  const timeSpan = geometry.maxTime - geometry.minTime || 1;
  const valueSpan = geometry.maxValue - geometry.minValue || 1;

  const x = left + ((time - geometry.minTime) / timeSpan) * (width - left - right);
  const y = height - bottom -
    ((point.value - geometry.minValue) / valueSpan) * (height - top - bottom);

  return { x, y };
}

function chartMarkup(title, series, days, suffix = "") {
  const geometry = chartGeometry(series, days);

  if (!geometry) {
    return `
      <div class="metric-chart-empty">
        No readings in this range
      </div>
    `;
  }

  const width = 320;
  const height = 148;
  const left = 40;
  const right = 12;
  const top = 16;
  const bottom = 24;

  const seriesMarkup = geometry.usable.map((item, seriesIndex) => {
    const positions = item.points.map(point => ({
      point,
      ...pointPosition(point, geometry)
    }));

    const path = positions.map((position, index) =>
      `${index === 0 ? "M" : "L"} ${position.x.toFixed(1)} ${position.y.toFixed(1)}`
    ).join(" ");

    const points = positions.map(position => {
      const displayValue = `${item.label} ${formatNumber(position.point.value)}${suffix}`;
      const displayDate = formatPointDate(position.point.date, days);

      return `
        <circle
          class="chart-point chart-point-${seriesIndex + 1}"
          cx="${position.x.toFixed(1)}"
          cy="${position.y.toFixed(1)}"
          r="4"
          tabindex="0"
          role="button"
          aria-label="${displayValue}, ${displayDate}"
          data-inspect-value="${displayValue}"
          data-inspect-date="${displayDate}"
        ></circle>
      `;
    }).join("");

    return `
      <path
        class="chart-line chart-line-${seriesIndex + 1}"
        d="${path}"
        vector-effect="non-scaling-stroke"
      ></path>
      ${points}
    `;
  }).join("");

  const latestText = geometry.usable.map(item => {
    const point = item.points.at(-1);
    return `${item.label} ${formatNumber(point.value)}${suffix}`;
  }).join(" • ");

  return `
    <div class="metric-chart">
      <div class="chart-readout" aria-live="polite">${latestText}</div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title} trend">
        <line class="chart-gridline" x1="${left}" y1="${top}" x2="${width - right}" y2="${top}"></line>
        <line class="chart-gridline" x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}"></line>

        <text class="chart-y-label" x="2" y="${top + 4}">${formatNumber(geometry.maxValue)}${suffix}</text>
        <text class="chart-y-label" x="2" y="${height - bottom + 4}">${formatNumber(geometry.minValue)}${suffix}</text>

        ${seriesMarkup}
      </svg>
      <div class="chart-axis">
        <span>${axisDate(geometry.minTime, days)}</span>
        <span>${axisDate(geometry.maxTime, days)}</span>
      </div>
    </div>
  `;
}

function metricCard({
  title,
  headline,
  context,
  detail,
  chart = "",
  compact = false
}) {
  return `
    <article class="metric-card${compact ? " metric-card-compact" : ""}">
      <div class="metric-header">
        <span class="metric-title">${title}</span>
        ${context ? `<span class="metric-context">${context}</span>` : ""}
      </div>
      <strong class="metric-value">${headline}</strong>
      ${detail ? `<p class="metric-detail">${detail}</p>` : ""}
      ${chart}
    </article>
  `;
}

function attachChartInspection(container) {
  const activate = point => {
    const card = point.closest(".metric-card");
    const readout = card?.querySelector(".chart-readout");
    if (!readout) return;

    readout.textContent =
      point.dataset.inspectValue + " · " + point.dataset.inspectDate;

    card.querySelectorAll(".chart-point.active").forEach(active => {
      active.classList.remove("active");
    });
    point.classList.add("active");
  };

  container.querySelectorAll(".chart-point").forEach(point => {
    point.addEventListener("click", () => activate(point));
    point.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate(point);
      }
    });
  });
}

export function renderDashboard(container, entries, days) {
  const stats = summarize(entries, days);
  const trends = buildTrendSeries(entries, days);

  const weightChange = formatChange(stats.weightChange, " lb");
  const waistChange = formatChange(stats.waistChange, " in");

  const weightDetail = [
    stats.latestWaist !== null ? `Waist ${formatNumber(stats.latestWaist)} in` : null,
    waistChange ? `${waistChange} waist` : null
  ].filter(Boolean).join(" • ");

  const latestBp = stats.latestSystolic !== null && stats.latestDiastolic !== null
    ? `Latest ${Math.round(stats.latestSystolic)}/${Math.round(stats.latestDiastolic)}`
    : null;

  const averageBp = stats.avgSystolic !== null && stats.avgDiastolic !== null
    ? `${Math.round(stats.avgSystolic)}/${Math.round(stats.avgDiastolic)}`
    : "—";

  const sleepDetail = [
    stats.avgSleepQuality !== null ? `Quality ${formatNumber(stats.avgSleepQuality)}/5` : null,
    stats.avgEnergy !== null ? `Energy ${formatNumber(stats.avgEnergy)}/5` : null
  ].filter(Boolean).join(" • ");

  container.innerHTML = [
    metricCard({
      title: "Weight",
      headline: stats.latestWeight === null ? "—" : `${formatNumber(stats.latestWeight)} lb`,
      context: weightChange ? `${weightChange} in range` : "Latest reading",
      detail: weightDetail || "No waist reading in this range",
      chart: chartMarkup(
        "Weight",
        [{ label: "Weight", points: trends.weight }],
        days,
        " lb"
      )
    }),
    metricCard({
      title: "Blood pressure",
      headline: stats.avgSystolic === null ? "—" : `Avg ${averageBp}`,
      context: latestBp,
      detail: stats.latestPulse !== null
        ? `Latest pulse ${Math.round(stats.latestPulse)} bpm`
        : "No pulse reading in this range",
      chart: chartMarkup(
        "Blood pressure",
        [
          { label: "Sys", points: trends.systolic },
          { label: "Dia", points: trends.diastolic }
        ],
        days
      )
    }),
    metricCard({
      title: "Sleep",
      headline: stats.avgSleep === null ? "—" : `Avg ${formatNumber(stats.avgSleep)} h`,
      context: stats.avgSleep === null ? null : "Across this range",
      detail: sleepDetail || "No daily check-ins in this range",
      chart: chartMarkup(
        "Sleep",
        [{ label: "Sleep", points: trends.sleep }],
        days,
        " h"
      )
    }),
    metricCard({
      title: "Activity",
      headline: `${stats.workoutCount} ${stats.workoutCount === 1 ? "workout" : "workouts"}`,
      context: `${stats.workoutMinutes} min total`,
      detail: stats.latestWorkoutType
        ? `Latest: ${stats.latestWorkoutType}`
        : "No workouts in this range",
      compact: true
    })
  ].join("");

  attachChartInspection(container);
}
