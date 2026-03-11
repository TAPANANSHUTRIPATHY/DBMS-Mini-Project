/* ================================================================
   dashboard.js — ENVCORE Historical Dashboard
   
   OPTIMIZATIONS vs original:
   1. Parallel fetch: all endpoints raced via Promise.any() → first
      successful response wins, eliminating sequential 10s timeouts.
   2. Raw data cache (60s TTL): switching dates or auto-refresh reuses
      previously fetched data without new network calls.
   3. animation: false on all existing charts for instant rendering.
   4. 24HR Master Chart: fixed 00:00–23:00 axis, date-aware,
      null gaps show as line breaks (spanGaps: false).

   Auto-refreshes every 30 s (silent) so today's data grows live.
================================================================ */

const API_DB = "https://dbms-mini-project-vgp4.onrender.com/api";
const ROWS_PER_PAGE = 50;
const FONT = "Rajdhani";
const TICK = "rgba(200,232,255,0.72)";
const GRID = "rgba(255,255,255,0.06)";

/* Fixed 24-hour X-axis labels */
const HOURS_24 = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

const COLORS = {
  temp: "rgb(255,128,128)",
  hum: "rgb(0,229,255)",
  aqi: "rgb(0,255,136)",
};

function rgba(c, a) { return c.replace("rgb(", "rgba(").replace(")", `,${a})`); }

let allData = [];
let currentPage = 1;
let selectedDate = todayStr();
let refreshTimer = null;

/* ── Chart instances ── */
let dbTempChart = null;
let dbHumChart = null;
let dbAqiChart = null;
let db24hrChart = null;

/* ================================================================
   RAW DATA CACHE  — avoid re-fetching within 60 s
================================================================ */
let _cachedRaw = null;
let _cachedDate = null;  /* date string the cache belongs to */
let _cacheExpiry = 0;    /* epoch ms */
const CACHE_TTL = 60000; /* 60 s */

/* ================================================================
   UTILITIES
================================================================ */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

function p2(n) { return String(n).padStart(2, "0"); }

function localDate(isoStr) {
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

function fmtTime(isoStr) { return new Date(isoStr).toLocaleTimeString("en-GB"); }
function fmtLong(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function dayName(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long" });
}
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function s1(v) { return Number(v).toFixed(1); }
function setEl(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

function healthScore(t, h, a) {
  return Math.round((Math.max(0, 100 - Math.abs(t - 22) * 4) +
    Math.max(0, 100 - Math.abs(h - 50) * 2) +
    Math.max(0, 100 - (a / 500) * 100)) / 3);
}

function aqiBadge(v) {
  if (v <= 50) return `<span class="badge-aqi badge-clean">Good</span>`;
  if (v <= 100) return `<span class="badge-aqi badge-moderate">Moderate</span>`;
  if (v <= 200) return `<span class="badge-aqi badge-poor">Unhealthy</span>`;
  return `<span class="badge-aqi badge-poor" style="color:#ff4d4d">Hazardous</span>`;
}

function hColor(s) {
  if (s >= 80) return "#00ff88";
  if (s >= 60) return "#00e5ff";
  if (s >= 40) return "#ffcc00";
  return "#ff4d4d";
}

/* ================================================================
   CHART INIT
================================================================ */
function buildLineChart(id, label, color, yMin, yMax, yStep) {
  const el = document.getElementById(id);
  if (!el) return null;
  const fill = rgba(color, 0.13);
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
      animation: false,   /* instant render — no animation delay */
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

function build24hrChart(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  return new Chart(el.getContext("2d"), {
    type: "line",
    data: {
      labels: HOURS_24,
      datasets: [
        {
          label: "Temperature (°C)", borderColor: COLORS.temp,
          backgroundColor: rgba(COLORS.temp, 0.08),
          data: new Array(24).fill(null),
          tension: 0.4, pointRadius: 3, pointHoverRadius: 6,
          borderWidth: 2.5, yAxisID: "y", fill: false, spanGaps: false,
        },
        {
          label: "Humidity (%)", borderColor: COLORS.hum,
          backgroundColor: rgba(COLORS.hum, 0.08),
          data: new Array(24).fill(null),
          tension: 0.4, pointRadius: 3, pointHoverRadius: 6,
          borderWidth: 2.5, yAxisID: "y1", fill: false, spanGaps: false,
        },
        {
          label: "Air Quality Index", borderColor: COLORS.aqi,
          backgroundColor: rgba(COLORS.aqi, 0.08),
          data: new Array(24).fill(null),
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
        x: { ticks: { color: TICK, font: { family: FONT, size: 10 }, maxTicksLimit: 24 }, grid: { color: GRID } },
        y: {
          type: "linear", position: "left",
          ticks: { color: COLORS.temp, font: { family: FONT, size: 10 } }, grid: { color: GRID },
          title: { display: true, text: "Temp (°C)", color: COLORS.temp, font: { family: FONT, size: 10 } },
        },
        y1: {
          type: "linear", position: "right",
          ticks: { color: COLORS.hum, font: { family: FONT, size: 10 } }, grid: { drawOnChartArea: false },
          title: { display: true, text: "Humidity (%)", color: COLORS.hum, font: { family: FONT, size: 10 } },
        },
        y2: {
          type: "linear", position: "right",
          ticks: { color: COLORS.aqi, font: { family: FONT, size: 10 } }, grid: { drawOnChartArea: false },
          title: { display: true, text: "AQI", color: COLORS.aqi, font: { family: FONT, size: 10 } },
        },
      },
    },
  });
}

document.addEventListener("DOMContentLoaded", () => {
  dbTempChart = buildLineChart("dbTempChart", "Temperature (°C)", COLORS.temp, -10, 60, 5);
  dbHumChart = buildLineChart("dbHumChart", "Humidity (%)", COLORS.hum, 0, 100, 5);
  dbAqiChart = buildLineChart("dbAqiChart", "Air Quality", COLORS.aqi, 0, 500, 50);
  db24hrChart = build24hrChart("db24hrChart");
});

/* ================================================================
   FETCH ALL RECORDS  — parallel strategy, cached
   
   All known URL patterns fire at once via Promise.any().
   First successful response wins. Result is cached 60 s so
   date switching and silent auto-refresh never re-fetch.
================================================================ */
async function fetchAllRecords(dateStr) {
  /* Return cached data if still fresh AND same date */
  if (_cachedRaw && Date.now() < _cacheExpiry && _cachedDate === dateStr) {
    console.log(`[ENVCORE] Using cached data (${_cachedRaw.length} rows) for ${dateStr}`);
    return _cachedRaw;
  }

  const timeout = ms => ({ signal: AbortSignal.timeout(ms) });

  try {
    // Send date to backend — SQL filters, only ~288 rows returned instead of 100,000+
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


/* ================================================================
   UPDATE 24HR MASTER CHART (date-aware hourly bucketing)
================================================================ */
function update24hrChart(dateRows) {
  if (!db24hrChart) return;
  const tempSlots = new Array(24).fill(null);
  const humSlots = new Array(24).fill(null);
  const aqiSlots = new Array(24).fill(null);

  dateRows.forEach(r => {
    const hour = new Date(r.created_at).getHours();
    const temp = parseFloat(r.temperature);
    const hum = parseFloat(r.humidity);
    const aqi = parseFloat(r.air_quality);
    if (!isNaN(temp)) tempSlots[hour] = temp;
    if (!isNaN(hum)) humSlots[hour] = hum;
    if (!isNaN(aqi)) aqiSlots[hour] = aqi;
  });

  db24hrChart.data.datasets[0].data = tempSlots;
  db24hrChart.data.datasets[1].data = humSlots;
  db24hrChart.data.datasets[2].data = aqiSlots;
  db24hrChart.update("none");
}

/* ================================================================
   UPDATE TIME-SERIES CHARTS  (sampled for performance)
================================================================ */
function updateCharts(data) {
  let pts = data;
  if (data.length > 300) {
    const step = Math.ceil(data.length / 300);
    pts = data.filter((_, i) => i % step === 0 || i === data.length - 1);
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

/* ================================================================
   SUMMARY CARDS
================================================================ */
function updateSummary(data) {
  const IDS = ["scTempAvg", "scTempMin", "scTempMax", "scTempCount",
    "scHumAvg", "scHumMin", "scHumMax", "scHumCount",
    "scAqiAvg", "scAqiMin", "scAqiMax", "scAqiCount",
    "scHealthVal", "scHealthMin", "scHealthMax", "scTotalRecords"];

  if (!data.length) {
    IDS.forEach(id => setEl(id, "--"));
    setEl("scHealthGrade", "No data");
    return;
  }
  const T = data.map(d => parseFloat(d.temperature));
  const H = data.map(d => parseFloat(d.humidity));
  const A = data.map(d => parseFloat(d.air_quality));
  const S = data.map(d => healthScore(d.temperature, d.humidity, d.air_quality));
  const avgS = Math.round(avg(S));

  setEl("scTempAvg", s1(avg(T)) + "°C"); setEl("scTempMin", s1(Math.min(...T))); setEl("scTempMax", s1(Math.max(...T))); setEl("scTempCount", data.length);
  setEl("scHumAvg", s1(avg(H)) + "%"); setEl("scHumMin", s1(Math.min(...H))); setEl("scHumMax", s1(Math.max(...H))); setEl("scHumCount", data.length);
  setEl("scAqiAvg", Math.round(avg(A))); setEl("scAqiMin", Math.round(Math.min(...A))); setEl("scAqiMax", Math.round(Math.max(...A))); setEl("scAqiCount", data.length);
  setEl("scHealthVal", avgS); setEl("scHealthMin", Math.min(...S)); setEl("scHealthMax", Math.max(...S)); setEl("scTotalRecords", data.length);

  const grade = avgS >= 80 ? "EXCELLENT" : avgS >= 60 ? "GOOD" : avgS >= 40 ? "MODERATE" : "POOR";
  setEl("scHealthGrade", grade);
  const col = hColor(avgS);
  const ve = document.getElementById("scHealthVal");
  const ge = document.getElementById("scHealthGrade");
  if (ve) ve.style.color = col;   /* data-driven color — must stay in JS */
  if (ge) ge.style.color = col;
}

/* ================================================================
   TABLE RENDER  (paginated)
================================================================ */
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
  currentPage = Math.max(1, Math.min(currentPage, total));
  const start = (currentPage - 1) * ROWS_PER_PAGE;
  const end = Math.min(start + ROWS_PER_PAGE, data.length);
  setEl("tableInfo", `Showing ${start + 1}–${end} of ${data.length} records`);

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

  /* Pagination */
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

  /* Wire pagination clicks via delegation (no inline event handlers) */
  pgEl.querySelectorAll(".pg-btn[data-page]").forEach(btn => {
    btn.addEventListener("click", () => goPage(parseInt(btn.dataset.page, 10)));
  });
  pgEl.querySelector("#pgPrev")?.addEventListener("click", () => goPage(currentPage - 1));
  pgEl.querySelector("#pgNext")?.addEventListener("click", () => goPage(currentPage + 1));
}

function goPage(p) {
  const t = Math.ceil(allData.length / ROWS_PER_PAGE);
  if (p < 1 || p > t) return;
  currentPage = p;
  renderTable(allData);
  document.querySelector(".table-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ================================================================
   LOAD DATE — main entry point
================================================================ */
async function loadDate(dateStr, silent = false) {
  selectedDate = dateStr;
  currentPage = 1;

  if (!silent) {
    document.getElementById("tableContainer").innerHTML =
      `<div class="state-box"><div class="spinner"></div>Fetching records for ${fmtLong(dateStr)}…
       <div class="state-sub">Collecting entries from the database — please wait.</div></div>`;
    document.getElementById("pagination").innerHTML = "";
    setEl("recordCount", "Fetching…");
  }

  try {
    // Backend now filters by date in SQL — no client-side filter needed
    const data = await fetchAllRecords(dateStr);

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

/* ================================================================
   AUTO-REFRESH every 30 s — silent, reuses cache
================================================================ */
function startRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    /* Invalidate cache for today so we always get fresh data */
    if (selectedDate === todayStr()) _cacheExpiry = 0;
    loadDate(selectedDate, true);
  }, 30000);
}

/* ================================================================
   CSV EXPORT
================================================================ */
document.addEventListener("DOMContentLoaded", () => {
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

  /* ── Date Picker ── */
  const picker = document.getElementById("datePicker");
  if (picker) {
    picker.value = todayStr();
    picker.max = todayStr();
    picker.addEventListener("change", () => {
      document.querySelectorAll(".qd-btn").forEach(b => b.classList.remove("active"));
      loadDate(picker.value);
      startRefresh();
    });
  }

  /* ── Quick Date Buttons ── */
  document.querySelectorAll(".qd-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".qd-btn").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      const d = new Date();
      d.setDate(d.getDate() - parseInt(this.dataset.offset, 10));
      const str = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
      if (picker) picker.value = str;
      loadDate(str);
      startRefresh();
    });
  });

  /* ── Clock ── */
  (function tick() {
    const e = document.getElementById("clockDisplay");
    if (e) e.textContent = new Date().toLocaleTimeString("en-GB");
    setTimeout(tick, 1000);
  })();

  /* ── Theme Toggle ── */
  document.getElementById("themeToggle")?.addEventListener("click", function () {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
    this.classList.toggle("light-mode", dark);
  });

  /* ── Background Canvas: handled by charts.js (weather animations) ── */


  /* ── Footer Ticker ── */
  const footerTicker = document.getElementById('footerTickerInner');
  if (footerTicker) {
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const nw = new Date();
    const dateStr = `${DAYS[nw.getDay()]}, ${nw.getDate()} ${MONTHS[nw.getMonth()]} ${nw.getFullYear()}`;
    const seg = `<div class="ft-segment">Made with <span class="ft-heart">❤</span><span class="ft-sep"></span><span class="ft-author">Tapananshu Tripathy</span><span class="ft-sep"></span><span class="ft-date">❆ ${dateStr} ❆</span><span class="ft-sep"></span>ENVCORE — Historical Dashboard<span class="ft-sep"></span>B.Tech CSE · KIIT University · Bhubaneswar</div>`;
    footerTicker.innerHTML = seg + seg;
  }

  /* ── Custom Cursor ── */
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

  /* ── Initial load ── */
  loadDate(todayStr());
  startRefresh();
});