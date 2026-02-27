/* ================================================================
   script.js — ENVCORE Data Layer
   • Fetches /api/latest and /api/history every 3 seconds
   • Backend offline = all values stay "--", NO stale humidity shown
   • Owns: tempChart (canvas: tempHumChart), airChart, tempGauge, airGauge
   • Exposes window.ENVDATA for charts.js
   • Live sliding window: last 60 readings (smooth live motion)
================================================================ */

const API_URL   = "http://localhost:5000/api";
const MAX_PTS   = 60;   /* live chart sliding window */

/* ── Shared data bus ── */
window.ENVDATA = {
  labels: [], temps: [], hums: [], aqis: [],
  latest: null, ready: false,
  backendOnline: false,
};

/* ── DOM refs ── */
const tempEl         = document.getElementById("temp");
const humEl          = document.getElementById("hum");
const airEl          = document.getElementById("air");
const airStatusEl    = document.getElementById("airStatus");
const airCard        = document.getElementById("airCard");
const tempGaugeValue = document.getElementById("tempGaugeValue");
const airGaugeValue  = document.getElementById("airGaugeValue");

/* ── AQI status ── */
function getAirStatus(v) {
  if (v < 1000) return { text: "🟢 Clean",    color: "#00ff88" };
  if (v < 2000) return { text: "🟡 Moderate", color: "#ffcc00" };
  return            { text: "🔴 Poor",      color: "#ff4d4d" };
}

/* ── Show "--" on all cards when offline ── */
function showOffline() {
  if (tempEl) tempEl.textContent = "-- °C";
  if (humEl)  humEl.textContent  = "-- %";
  if (airEl)  airEl.textContent  = "--";
  if (airStatusEl) airStatusEl.textContent = "--";
  if (tempGaugeValue) tempGaugeValue.textContent = "--";
  if (airGaugeValue)  airGaugeValue.textContent  = "--";
  window.ENVDATA.backendOnline = false;
  window.ENVDATA.ready         = false;
}

/* ================================================================
   CHART SETUP
================================================================ */
const FONT = "Rajdhani";
const TICK = "rgba(200,232,255,0.72)";
const GRID = "rgba(255,255,255,0.06)";

let tempChart = null;
let airChart  = null;
let tempGauge = null;
let airGauge  = null;

function makeLineChart(id, label, color, yMin, yMax, yStep) {
  const el = document.getElementById(id);
  if (!el) return null;
  const fill = color.replace("rgb(", "rgba(").replace(")", ",0.13)");
  return new Chart(el.getContext("2d"), {
    type: "line",
    data: { labels: [], datasets: [{ label, borderColor: color, backgroundColor: fill,
      data: [], tension: 0.4, pointRadius: 2, pointHoverRadius: 7,
      pointBackgroundColor: color, fill: true, borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 400, easing: "easeInOutQuart" },
      plugins: {
        legend: { labels: { color: TICK, font: { family: FONT, size: 13 }, boxWidth: 26, padding: 12 } },
        tooltip: { mode: "index", intersect: false, backgroundColor: "rgba(6,16,30,0.93)",
          borderColor: color, borderWidth: 1, titleColor: TICK, bodyColor: "#fff",
          titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12 },
      },
      scales: {
        x: { ticks: { color: TICK, maxTicksLimit: 12, maxRotation: 45, font: { family: FONT, size: 10 } }, grid: { color: GRID } },
        y: { min: yMin, max: yMax,
          ticks: { color: TICK, stepSize: yStep, maxTicksLimit: 16, font: { family: FONT, size: 10 } },
          grid: { color: GRID } },
      },
    },
  });
}

tempChart = makeLineChart("tempHumChart", "Temperature (°C)", "rgb(255,77,77)",  -10,  60,   5);
airChart  = makeLineChart("airChart",     "Air Quality",      "rgb(0,255,136)",    0, 3000, 250);

function makeGauge(id, color, maxVal) {
  const el = document.getElementById(id);
  if (!el) return null;
  return new Chart(el.getContext("2d"), {
    type: "doughnut",
    data: { datasets: [{ data: [0, maxVal], backgroundColor: [color, "#1e293b"], borderWidth: 0 }] },
    options: { rotation: -90, circumference: 180, cutout: "75%",
      animation: { duration: 500 }, plugins: { legend: { display: false } } },
  });
}

tempGauge = makeGauge("tempGauge", "#ff4d4d", 70);
airGauge  = makeGauge("airGauge",  "#00ff88", 3000);

/* ================================================================
   fetchLatest — update cards, gauges, ENVDATA.latest
================================================================ */
async function fetchLatest() {
  try {
    const res = await fetch(`${API_URL}/latest`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) { showOffline(); return; }
    const d = await res.json();
    if (!d) { showOffline(); return; }

    const temp = parseFloat(d.temperature);
    const hum  = parseFloat(d.humidity);
    const aqi  = parseFloat(d.air_quality);
    if (isNaN(temp) || isNaN(hum) || isNaN(aqi)) { showOffline(); return; }

    /* Update DOM */
    if (tempEl) tempEl.textContent = temp.toFixed(1) + " °C";
    if (humEl)  humEl.textContent  = hum.toFixed(1)  + " %";
    if (airEl)  airEl.textContent  = aqi;

    const status = getAirStatus(aqi);
    if (airStatusEl) airStatusEl.textContent = status.text;
    if (airCard)     airCard.style.boxShadow = `0 0 30px ${status.color}`;

    /* Gauges */
    if (tempGauge) {
      const pct = Math.min(Math.max(temp + 10, 0), 70);
      tempGauge.data.datasets[0].data = [pct, 70 - pct];
      tempGauge.update("none");
    }
    if (tempGaugeValue) tempGaugeValue.textContent = temp.toFixed(1) + " °C";

    if (airGauge) {
      const safeAqi = Math.min(Math.max(aqi, 0), 3000);
      airGauge.data.datasets[0].data = [safeAqi, 3000 - safeAqi];
      airGauge.data.datasets[0].backgroundColor[0] = status.color;
      airGauge.update("none");
    }
    if (airGaugeValue) airGaugeValue.textContent = aqi;

    window.ENVDATA.latest        = d;
    window.ENVDATA.backendOnline = true;

  } catch (_) {
    showOffline();
  }
}

/* ================================================================
   fetchHistory — build sliding window for live charts
   Shows last MAX_PTS readings, always refreshes on change
================================================================ */
let _lastTs = "";

async function fetchHistory() {
  try {
    const res = await fetch(`${API_URL}/history`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return;
    const raw = await res.json();
    if (!Array.isArray(raw) || !raw.length) return;

    /* Use last MAX_PTS for smooth live sliding window */
    const slice  = raw.slice(-MAX_PTS);
    const lastTs = slice[slice.length - 1]?.created_at || "";

    /* Only redraw if there's a new data point */
    if (lastTs === _lastTs) return;
    _lastTs = lastTs;

    const labels = slice.map(d => new Date(d.created_at).toLocaleTimeString("en-GB"));
    const temps  = slice.map(d => parseFloat(d.temperature));
    const hums   = slice.map(d => parseFloat(d.humidity));
    const aqis   = slice.map(d => parseFloat(d.air_quality));

    /* Push to shared data bus */
    window.ENVDATA.labels = labels;
    window.ENVDATA.temps  = temps;
    window.ENVDATA.hums   = hums;
    window.ENVDATA.aqis   = aqis;
    window.ENVDATA.ready  = true;

    /* Update own charts */
    if (tempChart) {
      tempChart.data.labels           = labels;
      tempChart.data.datasets[0].data = temps;
      tempChart.update();
    }
    if (airChart) {
      airChart.data.labels           = labels;
      airChart.data.datasets[0].data = aqis;
      airChart.update();
    }

  } catch (_) { /* silent — charts keep last state */ }
}

/* ================================================================
   Modal control (called from index.html onclick)
================================================================ */
window.openModal  = id => { const el = document.getElementById(id); if (el) el.style.display = "flex"; };
window.closeModal = id => { const el = document.getElementById(id); if (el) el.style.display = "none"; };

/* ================================================================
   Auto-refresh every 3 seconds
================================================================ */
setInterval(() => { fetchLatest(); fetchHistory(); }, 3000);
fetchLatest();
fetchHistory();