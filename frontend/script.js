/* ================================================================
   script.js — ENVCORE Live Data Layer
   • fetchLatest() every 1 second → appends new point to live charts
   • fetchHistory() every 10 seconds → syncs sliding window from DB
   • Backend offline = all values show "--", charts clear
   • Exposes window.ENVDATA for charts.js
   • MAX_PTS = 120 → 2 minutes of 1-second data visible at once
================================================================ */

const API_URL = "https://dbms-mini-project-vgp4.onrender.com/api";
const MAX_PTS = 120;   /* 2 min of live points at 1s interval */

/* ── Shared data bus ── */
window.ENVDATA = {
  labels: [], temps: [], hums: [], aqis: [],
  latest: null, ready: false, backendOnline: false,
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
      data: [], tension: 0.4, pointRadius: 1.5, pointHoverRadius: 6,
      pointBackgroundColor: color, fill: true, borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      /* NO animation on the main chart so scrolling feels instant */
      animation: false,
      plugins: {
        legend: { labels: { color: TICK, font: { family: FONT, size: 13 }, boxWidth: 26, padding: 12 } },
        tooltip: { mode: "index", intersect: false, backgroundColor: "rgba(6,16,30,0.93)",
          borderColor: color, borderWidth: 1, titleColor: TICK, bodyColor: "#fff",
          titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12 },
      },
      scales: {
        x: { ticks: { color: TICK, maxTicksLimit: 10, maxRotation: 45, font: { family: FONT, size: 10 } }, grid: { color: GRID } },
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
      animation: false, plugins: { legend: { display: false } } },
  });
}

tempGauge = makeGauge("tempGauge", "#ff4d4d", 70);
airGauge  = makeGauge("airGauge",  "#00ff88", 3000);

/* ================================================================
   APPEND ONE POINT to the live sliding window
   Called every second from fetchLatest
================================================================ */
function appendPoint(label, temp, hum, aqi) {
  const D = window.ENVDATA;

  /* Avoid duplicate timestamps */
  if (D.labels.length > 0 && D.labels[D.labels.length - 1] === label) return false;

  D.labels.push(label);
  D.temps.push(temp);
  D.hums.push(hum);
  D.aqis.push(aqi);

  /* Slide window */
  if (D.labels.length > MAX_PTS) {
    D.labels.shift(); D.temps.shift(); D.hums.shift(); D.aqis.shift();
  }
  D.ready         = true;
  D.backendOnline = true;
  return true; /* new point added */
}

/* ================================================================
   fetchLatest — every 1 second
   Updates cards, gauges, and appends one live point to charts
================================================================ */
let _latestTs = "";  /* track last seen timestamp to avoid duplicates */

async function fetchLatest() {
  try {
    const res = await fetch(`${API_URL}/latest`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) { showOffline(); return; }
    const d = await res.json();
    if (!d) { showOffline(); return; }

    const temp = parseFloat(d.temperature);
    const hum  = parseFloat(d.humidity);
    const aqi  = parseFloat(d.air_quality);
    if (isNaN(temp) || isNaN(hum) || isNaN(aqi)) { showOffline(); return; }

    /* Update DOM cards */
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
      tempGauge.update();
    }
    if (tempGaugeValue) tempGaugeValue.textContent = temp.toFixed(1) + " °C";

    if (airGauge) {
      const safeAqi = Math.min(Math.max(aqi, 0), 3000);
      airGauge.data.datasets[0].data = [safeAqi, 3000 - safeAqi];
      airGauge.data.datasets[0].backgroundColor[0] = status.color;
      airGauge.update();
    }
    if (airGaugeValue) airGaugeValue.textContent = aqi;

    window.ENVDATA.latest        = d;
    window.ENVDATA.backendOnline = true;

    /* Append to live sliding window */
    const ts    = d.created_at || new Date().toISOString();
    const label = new Date(ts).toLocaleTimeString("en-GB");
    const added = appendPoint(label, temp, hum, aqi);

    /* Push to charts on every call (even if same point — still update for gauge animations) */
    const D = window.ENVDATA;
    if (tempChart && D.labels.length > 0) {
      tempChart.data.labels           = D.labels;
      tempChart.data.datasets[0].data = D.temps;
      tempChart.update("none");  /* "none" = skip animation → instant scroll */
    }
    if (airChart && D.labels.length > 0) {
      airChart.data.labels           = D.labels;
      airChart.data.datasets[0].data = D.aqis;
      airChart.update("none");
    }

  } catch (_) {
    showOffline();
  }
}

/* ================================================================
   fetchHistory — every 10 seconds
   Syncs the full sliding window from DB history so the chart
   starts populated and stays in sync after any gap.
   Tries multiple URL patterns to handle different backends.
================================================================ */
let _historyLastTs = "";

async function fetchHistory() {
  /* Try multiple endpoint patterns in order */
  const endpoints = [
    `${API_URL}/history?limit=10000`,
    `${API_URL}/history?all=true`,
    `${API_URL}/history`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const raw = await res.json();
      if (!Array.isArray(raw) || !raw.length) continue;

      /* Got data — use it */
      const slice  = raw.slice(-MAX_PTS);
      const lastTs = slice[slice.length - 1]?.created_at || "";

      /* Only redraw if something changed */
      if (lastTs === _historyLastTs) break;
      _historyLastTs = lastTs;

      const labels = slice.map(d => new Date(d.created_at).toLocaleTimeString("en-GB"));
      const temps  = slice.map(d => parseFloat(d.temperature));
      const hums   = slice.map(d => parseFloat(d.humidity));
      const aqis   = slice.map(d => parseFloat(d.air_quality));

      window.ENVDATA.labels       = labels;
      window.ENVDATA.temps        = temps;
      window.ENVDATA.hums         = hums;
      window.ENVDATA.aqis         = aqis;
      window.ENVDATA.ready        = true;
      window.ENVDATA.backendOnline= true;

      if (tempChart) { tempChart.data.labels = labels; tempChart.data.datasets[0].data = temps; tempChart.update("none"); }
      if (airChart)  { airChart.data.labels  = labels; airChart.data.datasets[0].data  = aqis;  airChart.update("none"); }
      break;  /* success, stop trying */

    } catch (_) { continue; }
  }
}

/* ================================================================
   Modal control
================================================================ */
window.openModal  = id => { const el = document.getElementById(id); if (el) el.style.display = "flex"; };
window.closeModal = id => { const el = document.getElementById(id); if (el) el.style.display = "none"; };

/* ================================================================
   Timers:
   • fetchLatest  every 1000ms  → live chart scrolling + card updates
   • fetchHistory every 10000ms → sync full window from DB
================================================================ */
setInterval(fetchLatest,  1000);
setInterval(fetchHistory, 10000);

/* Initial load */
fetchHistory();   /* load history first so chart starts with data */
setTimeout(fetchLatest, 500);  /* then start live updates */