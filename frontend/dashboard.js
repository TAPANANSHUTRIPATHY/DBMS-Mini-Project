// dashboard.js — this handles everything on the historical dashboard page (dashboard.html)
// the user picks a date, we fetch all sensor readings for that day from the DB,
// and then display them in 4 charts + a summary stats panel + a paginated data table

const API_DB = "https://dbms-mini-project-vgp4.onrender.com/api";
const ROWS_PER_PAGE = 50;  // show 50 rows per page in the data table
const FONT = "Rajdhani";
const TICK = "rgba(200,232,255,0.72)";   // axis tick label color
const GRID = "rgba(255,255,255,0.06)";   // very subtle grid lines

// X-axis labels for the 24hr master chart — one label per 30-min slot (00:00, 00:30 … 23:30)
const HOURS_48 = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

// consistent colors for each metric across all charts
const COLORS = {
  temp: "rgb(255,128,128)",
  hum: "rgb(0,229,255)",
  aqi: "rgb(0,255,136)",
};

// helper to make a color semi-transparent by turning rgb( into rgba( and appending the alpha
function rgba(c, a) { return c.replace("rgb(", "rgba(").replace(")", `,${a})`); }

// state variables
let allData = [];           // all the rows fetched for the selected date
let currentPage = 1;        // which page of the table we're on
let selectedDate = todayStr();  // currently selected date (default to today)
let refreshTimer = null;    // holds the setInterval ID for auto-refresh

// chart instances — initialized in DOMContentLoaded
let dbTempChart = null;
let dbHumChart = null;
let dbAqiChart = null;
let db24hrChart = null;

// ─────────────────────────────────────────────────────────────────────────────
// RAW DATA CACHE — saves repeated network calls when switching tabs or on auto-refresh
// if we already have this date's data and it's less than 60 seconds old, use it
// ─────────────────────────────────────────────────────────────────────────────
let _cachedRaw = null;
let _cachedDate = null;   // which date the cached data belongs to
let _cacheExpiry = 0;     // epoch ms when the cache expires
const CACHE_TTL = 60000;  // 60 second cache lifetime

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

// returns today's date as "YYYY-MM-DD"
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

// pads a number to 2 digits (e.g. 5 → "05")
function p2(n) { return String(n).padStart(2, "0"); }

// converts a UTC ISO string to a "YYYY-MM-DD" in local time
// needed because JS Date parses UTC but we want to display in the user's local timezone
function localDate(isoStr) {
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

function fmtTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString("en-GB");  // formats as HH:MM:SS
}

// formats a date string as a long human-readable form like "Friday, 28 March 2025"
function fmtLong(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// just the day of week — used in CSV filenames
function dayName(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long" });
}

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function s1(v) { return Number(v).toFixed(1); }  // round to 1 decimal place as a string

// safely sets the text content of a DOM element by ID (does nothing if element not found)
function setEl(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

// calculates an overall environmental health score from 0–100
// ideal conditions: 22°C, 50% humidity, 0 AQI
// temp: -4 pts per 1°C away from ideal | humidity: -2 pts per 1% away | AQI: linear scale to 500
function healthScore(t, h, a) {
  return Math.round((Math.max(0, 100 - Math.abs(t - 22) * 4) +
    Math.max(0, 100 - Math.abs(h - 50) * 2) +
    Math.max(0, 100 - (a / 500) * 100)) / 3);
}

// returns an HTML badge showing the AQI category (Good / Moderate / etc.)
function aqiBadge(v) {
  if (v <= 50) return `<span class="badge-aqi badge-clean">Good</span>`;
  if (v <= 100) return `<span class="badge-aqi badge-moderate">Moderate</span>`;
  if (v <= 200) return `<span class="badge-aqi badge-poor">Unhealthy</span>`;
  return `<span class="badge-aqi badge-poor" style="color:#ff4d4d">Hazardous</span>`;
}

// maps a health score to a color — green (excellent) to red (poor)
function hColor(s) {
  if (s >= 80) return "#00ff88";
  if (s >= 60) return "#00e5ff";
  if (s >= 40) return "#ffcc00";
  return "#ff4d4d";
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

// creates a single-metric line chart with our standard dark styling
function buildLineChart(id, label, color, yMin, yMax, yStep) {
  const el = document.getElementById(id);
  if (!el) return null;
  const fill = rgba(color, 0.13);  // translucent fill under the line
  return new Chart(el.getContext("2d"), {
    type: "line",
    data: {
      labels: [], datasets: [{
        label, borderColor: color, backgroundColor: fill,
        data: [], tension: 0.4, pointRadius: 2, pointHoverRadius: 6,
        pointBackgroundColor: color, fill: true, borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: false,   // no animation — data loads instantly on date switch
      plugins: {
        legend: { labels: { color: TICK, font: { family: FONT, size: 13 }, boxWidth: 26, padding: 12 } },
        tooltip: {
          mode: "index", intersect: false, backgroundColor: "rgba(6,16,30,0.93)",
          borderColor: color, borderWidth: 1, titleColor: TICK, bodyColor: "#fff",
          titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12
        },
      },
      scales: {
        x: { ticks: { color: TICK, maxTicksLimit: 20, maxRotation: 45, font: { family: FONT, size: 10 } }, grid: { color: GRID } },
        y: {
          min: yMin, max: yMax,
          ticks: { color: TICK, stepSize: yStep, maxTicksLimit: 18, font: { family: FONT, size: 10 } },
          grid: { color: GRID }
        },
      },
    },
  });
}

// builds the big 24-hour master chart with all 3 metrics on separate Y axes
// uses 48 fixed slots (one per 30 min) — null means no reading in that slot → shows as a line break
// each metric gets its own color-coded Y axis (left, right, far-right)
function build24hrChart(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  return new Chart(el.getContext("2d"), {
    type: "line",
    data: {
      labels: HOURS_48,  // fixed 48 labels regardless of missing data
      datasets: [
        {
          label: "Temperature (°C)", borderColor: COLORS.temp,
          // single solid color throughout — no dynamic per-segment coloring
          backgroundColor: rgba(COLORS.temp, 0.08),
          data: new Array(48).fill(null),  // start with all nulls (no data)
          tension: 0.4, pointRadius: 3, pointHoverRadius: 6,
          borderWidth: 2.5, yAxisID: "y", fill: false, spanGaps: false,  // spanGaps:false = line breaks at null
        },
        {
          label: "Humidity (%)", borderColor: COLORS.hum,
          backgroundColor: rgba(COLORS.hum, 0.08),
          data: new Array(48).fill(null),
          tension: 0.4, pointRadius: 3, pointHoverRadius: 6,
          borderWidth: 2.5, yAxisID: "y1", fill: false, spanGaps: false,
        },
        {
          label: "Air Quality Index", borderColor: COLORS.aqi,
          // single solid color throughout — no dynamic per-segment coloring
          backgroundColor: rgba(COLORS.aqi, 0.08),
          data: new Array(48).fill(null),
          tension: 0.4, pointRadius: 3, pointHoverRadius: 6,
          borderWidth: 2.5, yAxisID: "y2", fill: false, spanGaps: false,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 400, easing: "easeOutQuart" },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: TICK, font: { family: FONT, size: 12 }, boxWidth: 20, padding: 16 },
        },
        tooltip: {
          backgroundColor: "rgba(6,16,30,0.93)",
          titleColor: TICK, bodyColor: "#fff",
          titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12,
          callbacks: {
            label: ctx => ctx.parsed.y === null ? null : `${ctx.dataset.label}: ${ctx.parsed.y}`,
          },
        },
      },
      scales: {
        x: { ticks: { color: TICK, font: { family: FONT, size: 10 }, maxTicksLimit: 48, maxRotation: 45 }, grid: { color: GRID } },
        y: {
          type: "linear", position: "left",
          grace: "15%",
          ticks: { color: COLORS.temp, font: { family: FONT, size: 10 } }, grid: { color: GRID },
          title: { display: true, text: "Temp (°C)", color: COLORS.temp, font: { family: FONT, size: 10 } },
        },
        y1: {
          type: "linear", position: "right",
          grace: "15%",
          ticks: { color: COLORS.hum, font: { family: FONT, size: 10 } }, grid: { drawOnChartArea: false },  // don't draw horizontal grid for this axis (would overlap)
          title: { display: true, text: "Humidity (%)", color: COLORS.hum, font: { family: FONT, size: 10 } },
        },
        y2: {
          type: "linear", position: "right",
          grace: "20%",
          ticks: { color: COLORS.aqi, font: { family: FONT, size: 10 } }, grid: { drawOnChartArea: false },
          title: { display: true, text: "AQI", color: COLORS.aqi, font: { family: FONT, size: 10 } },
        },
      },
    },
  });
}

// build all charts once the DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  dbTempChart = buildLineChart("dbTempChart", "Temperature (°C)", COLORS.temp, -10, 60, 5);
  dbHumChart = buildLineChart("dbHumChart", "Humidity (%)", COLORS.hum, 0, 100, 5);
  dbAqiChart = buildLineChart("dbAqiChart", "Air Quality", COLORS.aqi, 0, 500, 50);
  db24hrChart = build24hrChart("db24hrChart");
});

// ─────────────────────────────────────────────────────────────────────────────
// FETCH WITH CACHE
// we cache the fetched data for 60 seconds so switching back to a date doesn't
// re-hit the backend — also makes the silent auto-refresh much faster
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAllRecords(dateStr) {
  // return cached data if it's fresh and for the same date
  if (_cachedRaw && Date.now() < _cacheExpiry && _cachedDate === dateStr) {
    console.log(`[ENVCORE] Using cached data (${_cachedRaw.length} rows) for ${dateStr}`);
    return _cachedRaw;
  }

  const timeout = ms => ({ signal: AbortSignal.timeout(ms) });

  try {
    // backend filters by date in SQL, so we get only ~288 rows (one per 5 min) not 100k+
    const url = dateStr
      ? `${API_DB}/history?date=${dateStr}`
      : `${API_DB}/history`;

    const r = await fetch(url, timeout(12000));
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const raw = await r.json();
    if (!Array.isArray(raw)) throw new Error("Invalid response");

    console.log(`[ENVCORE] Fetched ${raw.length} records for ${dateStr}.`);
    _cachedRaw = raw;
    _cachedDate = dateStr;
    _cacheExpiry = Date.now() + CACHE_TTL;
    return raw;
  } catch (err) {
    console.error("[ENVCORE] fetchAllRecords error:", err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE 24HR CHART (slot bucketing)
// each sensor reading is put into one of 48 30-min slots based on its timestamp
// slots with no reading stay null → chart shows a line break there
// the very last data point gets a bigger dot to show the "live edge" (like ISRO telemetry)
// ─────────────────────────────────────────────────────────────────────────────
function update24hrChart(dateRows) {
  if (!db24hrChart) return;
  const tempSlots = new Array(48).fill(null);
  const humSlots = new Array(48).fill(null);
  const aqiSlots = new Array(48).fill(null);

  let lastSlotIndex = -1;  // tracks the most recent slot that has data (for the pulse dot)

  dateRows.forEach(r => {
    const d = new Date(r.created_at);
    // each slot = 30 minutes, slot index 0 = 00:00, slot index 47 = 23:30
    const slot = (d.getHours() * 2) + Math.floor(d.getMinutes() / 30);
    if (slot > lastSlotIndex) lastSlotIndex = slot;

    const temp = parseFloat(r.temperature);
    const hum = parseFloat(r.humidity);
    const aqi = parseFloat(r.air_quality);

    // skip clearly invalid values (0°C or 0% humidity are almost always sensor errors)
    if (!isNaN(temp) && temp !== 0) tempSlots[slot] = temp;
    if (!isNaN(hum) && hum !== 0) humSlots[slot] = hum;
    if (!isNaN(aqi)) aqiSlots[slot] = aqi;
  });

  db24hrChart.data.datasets[0].data = tempSlots;
  db24hrChart.data.datasets[1].data = humSlots;
  db24hrChart.data.datasets[2].data = aqiSlots;

  // make the last data point slightly bigger — gives a "pulse" effect at the live edge
  db24hrChart.data.datasets.forEach(ds => {
    ds.pointRadius = ds.data.map((val, idx) => (val !== null && idx === lastSlotIndex) ? 7 : 3);
    ds.pointHoverRadius = ds.data.map((val, idx) => (val !== null && idx === lastSlotIndex) ? 9 : 6);
  });

  db24hrChart.update("none");  // no animation, instant update
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE TIME-SERIES CHARTS
// if there are more than 300 rows, we sample the data (take every Nth row)
// so the charts don't get too cluttered with thousands of points
// ─────────────────────────────────────────────────────────────────────────────
function updateCharts(data) {
  let pts = data;
  if (data.length > 300) {
    const step = Math.ceil(data.length / 300);
    pts = data.filter((_, i) => i % step === 0 || i === data.length - 1);  // always include the last point
  }
  const labels = pts.map(d => fmtTime(d.created_at));
  const temps = pts.map(d => parseFloat(d.temperature));
  const hums = pts.map(d => parseFloat(d.humidity));
  const aqis = pts.map(d => parseFloat(d.air_quality));

  [[dbTempChart, temps], [dbHumChart, hums], [dbAqiChart, aqis]].forEach(([ch, vals]) => {
    if (!ch) return;
    ch.data.labels = labels; ch.data.datasets[0].data = vals; ch.update("none");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY CARDS — shows avg/min/max for each metric plus the overall health score
// ─────────────────────────────────────────────────────────────────────────────
function updateSummary(data) {
  const IDS = ["scTempAvg", "scTempMin", "scTempMax", "scTempCount",
    "scHumAvg", "scHumMin", "scHumMax", "scHumCount",
    "scAqiAvg", "scAqiMin", "scAqiMax", "scAqiCount",
    "scHealthVal", "scHealthMin", "scHealthMax", "scTotalRecords"];

  if (!data.length) {
    IDS.forEach(id => setEl(id, "--"));  // nothing to show — fill with dashes
    setEl("scHealthGrade", "No data");
    return;
  }

  // filter out NaN and 0 values (0 usually means the sensor wasn't sending yet)
  const T = data.map(d => parseFloat(d.temperature)).filter(v => !isNaN(v) && v !== 0);
  const H = data.map(d => parseFloat(d.humidity)).filter(v => !isNaN(v) && v !== 0);
  const A = data.map(d => parseFloat(d.air_quality)).filter(v => !isNaN(v));
  const S = data.map(d => healthScore(d.temperature, d.humidity, d.air_quality))
    .filter(v => v > 0);
  const avgS = S.length ? Math.round(avg(S)) : 0;

  setEl("scTempAvg", T.length ? s1(avg(T)) + "°C" : "--"); setEl("scTempMin", T.length ? s1(Math.min(...T)) : "--"); setEl("scTempMax", T.length ? s1(Math.max(...T)) : "--"); setEl("scTempCount", data.length);
  setEl("scHumAvg", H.length ? s1(avg(H)) + "%" : "--"); setEl("scHumMin", H.length ? s1(Math.min(...H)) : "--"); setEl("scHumMax", H.length ? s1(Math.max(...H)) : "--"); setEl("scHumCount", data.length);
  setEl("scAqiAvg", A.length ? Math.round(avg(A)) : "--"); setEl("scAqiMin", A.length ? Math.round(Math.min(...A)) : "--"); setEl("scAqiMax", A.length ? Math.round(Math.max(...A)) : "--"); setEl("scAqiCount", data.length);
  setEl("scHealthVal", avgS); setEl("scHealthMin", S.length ? Math.min(...S) : "--"); setEl("scHealthMax", S.length ? Math.max(...S) : "--"); setEl("scTotalRecords", data.length);

  const grade = avgS >= 80 ? "EXCELLENT" : avgS >= 60 ? "GOOD" : avgS >= 40 ? "MODERATE" : "POOR";
  setEl("scHealthGrade", grade);
  const col = hColor(avgS);
  const ve = document.getElementById("scHealthVal");
  const ge = document.getElementById("scHealthGrade");
  if (ve) ve.style.color = col;   // color the number itself based on how good/bad the score is
  if (ge) ge.style.color = col;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA TABLE — paginated, shows each sensor reading with its health score
// ─────────────────────────────────────────────────────────────────────────────
function renderTable(data) {
  const box = document.getElementById("tableContainer");
  const pgEl = document.getElementById("pagination");
  if (!box || !pgEl) return;

  if (!data.length) {
    box.innerHTML = `<div class="state-box"><span class="state-icon">📭</span>
      No records for ${fmtLong(selectedDate)}.
      <div class="state-sub">Check your database or pick another date.</div></div>`;
    pgEl.innerHTML = ""; setEl("tableInfo", "0 records"); return;
  }

  const total = Math.ceil(data.length / ROWS_PER_PAGE);
  currentPage = Math.max(1, Math.min(currentPage, total));  // clamp page within valid range
  const start = (currentPage - 1) * ROWS_PER_PAGE;
  const end = Math.min(start + ROWS_PER_PAGE, data.length);
  setEl("tableInfo", `Showing ${start + 1}–${end} of ${data.length} records`);

  // build the table rows for the current page slice
  const rows = data.slice(start, end).map((d, i) => {
    const hs = healthScore(d.temperature, d.humidity, d.air_quality);
    const ac = d.air_quality <= 100 ? "td-clean" : d.air_quality <= 200 ? "td-moderate" : "td-poor";
    return `<tr>
      <td class="td-time">${start + i + 1}</td>
      <td class="td-time">${fmtTime(d.created_at)}</td>
      <td class="td-temp">${s1(d.temperature)} °C</td>
      <td class="td-hum">${s1(d.humidity)} %</td>
      <td class="${ac}">${d.air_quality} ${aqiBadge(d.air_quality)}</td>
      <td style="color:${hColor(hs)};font-weight:600">${hs}</td>
    </tr>`;
  }).join("");

  box.innerHTML = `<div class="table-scroll"><table class="data-table">
    <thead><tr><th>#</th><th>Time</th><th>Temperature</th><th>Humidity</th><th>Air Quality</th><th>Health Score</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;

  // build the pagination bar with ellipsis for large page counts
  const R = 5, h = Math.floor(R / 2);
  let ps = Math.max(1, currentPage - h), pe = Math.min(total, ps + R - 1);
  if (pe - ps < R - 1) ps = Math.max(1, pe - R + 1);
  let pg = `<button class="pg-btn" id="pgPrev" ${currentPage <= 1 ? "disabled" : ""}>&#8592; Prev</button>`;
  if (ps > 1) { pg += `<button class="pg-btn" data-page="1">1</button>`; if (ps > 2) pg += `<span class="pg-info">…</span>`; }
  for (let p = ps; p <= pe; p++) pg += `<button class="pg-btn${p === currentPage ? " active" : ""}" data-page="${p}">${p}</button>`;
  if (pe < total) { if (pe < total - 1) pg += `<span class="pg-info">…</span>`; pg += `<button class="pg-btn" data-page="${total}">${total}</button>`; }
  pg += `<button class="pg-btn" id="pgNext" ${currentPage >= total ? "disabled" : ""}>Next &#8594;</button>`;
  pg += `<span class="pg-info">Page ${currentPage} of ${total}</span>`;
  pgEl.innerHTML = pg;

  // wire up the pagination buttons via event delegation (not inline onclick handlers)
  pgEl.querySelectorAll(".pg-btn[data-page]").forEach(btn => {
    btn.addEventListener("click", () => goPage(parseInt(btn.dataset.page, 10)));
  });
  pgEl.querySelector("#pgPrev")?.addEventListener("click", () => goPage(currentPage - 1));
  pgEl.querySelector("#pgNext")?.addEventListener("click", () => goPage(currentPage + 1));
}

// handles page changes — clamps to valid range, re-renders, and scrolls the table into view
function goPage(p) {
  const t = Math.ceil(allData.length / ROWS_PER_PAGE);
  if (p < 1 || p > t) return;
  currentPage = p;
  renderTable(allData);
  document.querySelector(".table-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD DATE — main function that ties everything together
// called when the user picks a date or on auto-refresh
// silent=true means skip the loading spinner (used for background refresh)
// ─────────────────────────────────────────────────────────────────────────────
async function loadDate(dateStr, silent = false) {
  selectedDate = dateStr;
  currentPage = 1;

  if (!silent) {
    // show a loading state while we fetch
    document.getElementById("tableContainer").innerHTML =
      `<div class="state-box"><div class="spinner"></div>Fetching records for ${fmtLong(dateStr)}…
       <div class="state-sub">Collecting entries from the database — please wait.</div></div>`;
    document.getElementById("pagination").innerHTML = "";
    setEl("recordCount", "Fetching…");
  }

  try {
    const data = await fetchAllRecords(dateStr);  // uses cache if available

    console.log(`[ENVCORE] Records for ${dateStr}: ${data.length}`);
    allData = data;
    setEl("recordCount", data.length + " records");
    updateSummary(data);
    update24hrChart(data);
    updateCharts(data);
    renderTable(data);
  } catch (err) {
    document.getElementById("tableContainer").innerHTML =
      `<div class="state-box"><span class="state-icon">⚠</span>Backend unreachable.
       <div class="state-sub">${err.message}</div></div>`;
    setEl("recordCount", "Error");
    console.error("[ENVCORE] loadDate error:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-REFRESH every 30 seconds
// silently re-fetches data in the background so today's live data grows in real time
// we invalidate the cache first if it's today's date, so we actually get new rows
// ─────────────────────────────────────────────────────────────────────────────
function startRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (selectedDate === todayStr()) _cacheExpiry = 0;  // force re-fetch for today's data
    loadDate(selectedDate, true);  // silent = true, no spinner
  }, 30000);
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV + PDF EXPORT, DATE PICKER, BUTTONS, CLOCK, CURSOR, FOOTER
// all wired up in DOMContentLoaded
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  // CSV export — builds a comma-separated file from allData and triggers a download
  document.getElementById("csvBtn")?.addEventListener("click", () => {
    if (!allData.length) { alert("No data for this date."); return; }
    const fname = `sensor-data-${dayName(selectedDate)}-${selectedDate}.csv`;
    let csv = "Time,Temperature (°C),Humidity (%),Air Quality,Health Score,AQI Status\n";
    allData.forEach(d => {
      const hs = healthScore(d.temperature, d.humidity, d.air_quality);
      const st = d.air_quality <= 100 ? "Good" : d.air_quality <= 200 ? "Moderate" : "Poor";
      csv += `${fmtTime(d.created_at)},${d.temperature},${d.humidity},${d.air_quality},${hs},${st}\n`;
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `exports/${fname}`; document.body.appendChild(a); a.click();
    document.body.removeChild(a);
  });

  // PDF export — uses html2canvas to screenshot the dashboard, then jsPDF to embed it in a PDF
  document.getElementById("pdfBtn")?.addEventListener("click", () => {
    if (!allData.length) { alert("No data for this date."); return; }

    const pdfBtn = document.getElementById("pdfBtn");
    const origText = pdfBtn.innerHTML;
    pdfBtn.innerHTML = "Generating...";  // show a loading label while rendering

    // hide the action buttons from the screenshot (they'd look weird in the PDF)
    const actions = document.querySelector(".date-bar-right");
    if (actions) actions.style.display = "none";

    // hide the data table — we only want the charts and summary in the PDF
    const tablePanels = document.querySelectorAll(".table-panel, #tableContainer, #pagination");
    const originalDisplays = [];
    tablePanels.forEach((el, index) => {
      originalDisplays[index] = el.style.display;
      el.style.display = "none";
    });

    const exportArea = document.querySelector(".db-wrap");

    html2canvas(exportArea, { scale: 1.5, backgroundColor: "#06101e", useCORS: true }).then(canvas => {
      // restore the DOM back to normal before saving the PDF
      if (actions) actions.style.display = "flex";
      tablePanels.forEach((el, index) => {
        el.style.display = originalDisplays[index];
      });
      pdfBtn.innerHTML = origText;

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "mm", "a4");  // portrait A4

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;  // scale proportionally

      // header text at the top of the page
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text(`ENVCORE Dashboard Report: ${selectedDate}`, 15, 15);

      pdf.addImage(imgData, "JPEG", 5, 25, pdfWidth - 10, pdfHeight);
      pdf.save(`ENVCORE_Report_${selectedDate}.pdf`);
    }).catch(err => {
      // restore DOM even if the export fails
      if (actions) actions.style.display = "flex";
      tablePanels.forEach((el, index) => {
        el.style.display = originalDisplays[index];
      });
      pdfBtn.innerHTML = origText;
      console.error("PDF generation failed", err);
    });
  });

  // date picker — when user picks a new date, load that date's data
  const picker = document.getElementById("datePicker");
  if (picker) {
    picker.value = todayStr();
    picker.max = todayStr();  // prevent picking future dates
    picker.addEventListener("change", () => {
      document.querySelectorAll(".qd-btn").forEach(b => b.classList.remove("active"));  // deselect quick-date buttons
      loadDate(picker.value);
      startRefresh();
    });
  }

  // quick-date buttons (Today, Yesterday, 2 days ago etc.) — each has a data-offset attribute
  document.querySelectorAll(".qd-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".qd-btn").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      const d = new Date();
      d.setDate(d.getDate() - parseInt(this.dataset.offset, 10));  // go back N days
      const str = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
      if (picker) picker.value = str;
      loadDate(str);
      startRefresh();
    });
  });

  // live clock display in the header — updates every second
  (function tick() {
    const e = document.getElementById("clockDisplay");
    if (e) e.textContent = new Date().toLocaleTimeString("en-GB");
    setTimeout(tick, 1000);
  })();

  // dark/light theme toggle — swaps data-theme attribute on <html> and updates button style
  document.getElementById("themeToggle")?.addEventListener("click", function () {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
    this.classList.toggle("light-mode", dark);
  });

  // footer scrolling ticker — built the same way as index.html
  // duplicated so the CSS marquee animation loops seamlessly
  const footerTicker = document.getElementById('footerTickerInner');
  if (footerTicker) {
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const nw = new Date();
    const dateStr = `${DAYS[nw.getDay()]}, ${nw.getDate()} ${MONTHS[nw.getMonth()]} ${nw.getFullYear()}`;
    const seg = `<div class="ft-segment">Made with <span class="ft-heart">❤</span><span class="ft-sep"></span><span class="ft-author">Tapananshu Tripathy</span><span class="ft-sep"></span><span class="ft-date">❆ ${dateStr} ❆</span><span class="ft-sep"></span>ENVCORE — Historical Dashboard<span class="ft-sep"></span>B.Tech CSE · KIIT University · Bhubaneswar</div>`;
    footerTicker.innerHTML = seg + seg;  // double segment for seamless animation loop
  }

  // custom cursor — neon dot + outer ring, same logic as index.html
  const cursor = document.getElementById('customCursor');
  const cursorRing = document.getElementById('customCursorRing');
  if (cursor && cursorRing) {
    document.addEventListener('mousemove', e => {
      requestAnimationFrame(() => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
        cursorRing.style.left = `${e.clientX}px`;
        cursorRing.style.top = `${e.clientY}px`;
      });
    });
    document.addEventListener('mousedown', () => document.body.classList.add('cursor-clicking'));
    document.addEventListener('mouseup', () => document.body.classList.remove('cursor-clicking'));
    const sel = 'a, button, input, textarea, .clickable';
    document.body.addEventListener('mouseover', e => { if (e.target.closest(sel)) document.body.classList.add('cursor-hovering'); });
    document.body.addEventListener('mouseout', e => { if (e.target.closest(sel)) document.body.classList.remove('cursor-hovering'); });
  }

  // initial load — fetch today's data when the page first opens
  loadDate(todayStr());
  startRefresh();  // start the 30-second silent refresh loop
});