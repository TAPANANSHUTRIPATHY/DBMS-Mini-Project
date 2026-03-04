/* ================================================================
   script.js — ENVCORE Live Data Layer
   • fetchLatest() every 1 second → appends new point to live charts
   • fetchHistory() every 10 seconds → syncs sliding window from DB
   • Backend offline = all values show "--", charts clear
   • Exposes window.ENVDATA for charts.js
   • MAX_PTS = 40 → last 40 readings of 1s interval visible at once
================================================================ */

const API_URL = "https://dbms-mini-project-vgp4.onrender.com/api";
const MAX_PTS = 40;

/* Expose API URL for forecast.js (formerly an inline script tag in HTML) */
window._ENVCORE_API_URL = API_URL;

/* ── Shared data bus ── */
window.ENVDATA = {
  labels: [], temps: [], hums: [], aqis: [],
  latest: null, ready: false, backendOnline: false,
};

/* ── DOM refs ── */
const tempEl = document.getElementById("temp");
const humEl = document.getElementById("hum");
const airEl = document.getElementById("air");
const airStatusEl = document.getElementById("airStatus");
const airCard = document.getElementById("airCard");
const tempGaugeValue = document.getElementById("tempGaugeValue");
const airGaugeValue = document.getElementById("airGaugeValue");

/* ── AQI status ── */
function getAirStatus(v) {
  if (v <= 50) return { text: "🟢 Good", color: "#00ff88" };
  if (v <= 100) return { text: "🟡 Moderate", color: "#ffcc00" };
  if (v <= 150) return { text: "🟠 Unhealthy (Sensitive)", color: "#ff9900" };
  if (v <= 200) return { text: "🔴 Unhealthy", color: "#ff4d4d" };
  if (v <= 300) return { text: "🟣 Very Unhealthy", color: "#cc0099" };
  return { text: "🟤 Hazardous", color: "#800000" };
}

/* ── Show "--" on all cards when offline ── */
function showOffline() {
  if (tempEl) tempEl.textContent = "-- °C";
  if (humEl) humEl.textContent = "-- %";
  if (airEl) airEl.textContent = "--";
  if (airStatusEl) airStatusEl.textContent = "--";
  if (tempGaugeValue) tempGaugeValue.textContent = "--";
  if (airGaugeValue) airGaugeValue.textContent = "--";
  window.ENVDATA.backendOnline = false;
  window.ENVDATA.ready = false;
  /* Device Status Panel — Offline */
  const dot = document.getElementById('dspDot');
  const status = document.getElementById('dspStatus');
  if (dot) { dot.style.background = '#ff4d4d'; dot.style.boxShadow = '0 0 8px #ff4d4d'; }
  if (status) status.textContent = 'Offline';
}

/* ================================================================
   CITY WEATHER NEWS TICKER
   Uses Open-Meteo (free, no key) + localStorage user_lat/user_lon
================================================================ */

const WMO_CODES = {
  0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  77: 'Snow grains', 80: 'Light showers', 81: 'Rain showers', 82: 'Heavy showers',
  95: 'Thunderstorm', 96: 'Storm w/ hail', 99: 'Heavy storm',
};
const WMO_EMOJI = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '❄️', 75: '❄️', 80: '🌦️', 81: '🌧️', 82: '🌧️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

function getHealthAdvice(aqi) {
  if (aqi <= 50) return null;
  if (aqi <= 100) return 'Sensitive groups limit outdoor activity.';
  if (aqi <= 150) return 'Unhealthy for sensitive groups — keep windows closed.';
  if (aqi <= 200) return 'Unhealthy air — wear mask outdoors.';
  if (aqi <= 300) return 'Very unhealthy — avoid outdoor activities.';
  return 'HAZARDOUS — stay indoors, wear N95 mask.';
}

function getAirLevelName(aqi) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

/* Cached weather state */
let _cityWeather = null;
let _weatherFetchedAt = 0;
const WEATHER_TTL = 10 * 60 * 1000; // 10-min refresh

async function fetchCityWeather() {
  const lat = parseFloat(localStorage.getItem('user_lat'));
  const lon = parseFloat(localStorage.getItem('user_lon'));
  if (isNaN(lat) || isNaN(lon)) return;
  if (Date.now() - _weatherFetchedAt < WEATHER_TTL && _cityWeather) return;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index` +
      `&wind_speed_unit=kmh&timezone=auto`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return;
    const d = await r.json();
    const c = d.current;
    const code = c.weather_code ?? 0;
    _cityWeather = {
      temp: (c.temperature_2m ?? '--').toString().split('.')[0] + '.' + (c.temperature_2m?.toFixed(1).split('.')[1] ?? '0'),
      feelsLike: c.apparent_temperature?.toFixed(1) ?? '--',
      humidity: c.relative_humidity_2m ?? '--',
      wind: c.wind_speed_10m?.toFixed(0) ?? '--',
      uvIndex: c.uv_index?.toFixed(1) ?? '--',
      condition: WMO_CODES[code] ?? 'Unknown',
      icon: WMO_EMOJI[code] ?? '🌡️',
    };
    _weatherFetchedAt = Date.now();
    rebuildTicker();
  } catch (_) { }
}

/* Build + show the ticker */
let _tickerAqi = null;
let _tickerStatus = null;

function rebuildTicker() {
  const banner = document.getElementById('alertBanner');
  const textEl = document.getElementById('alertText');
  if (!banner || !textEl) return;

  const city = localStorage.getItem('user_location') || 'ENVCORE Station';
  const w = _cityWeather;
  const aqi = _tickerAqi;

  const parts = ['\u00a0\u00a0\u00a0\u00a0'];

  // City name
  parts.push(`📍 ${city.split(',')[0].trim()}`);

  // Weather block
  if (w) {
    parts.push(
      `${w.icon} ${w.condition}`,
      `🌡️ Temp: ${w.temp}°C  (Feels ${w.feelsLike}°C)`,
      `💧 Humidity: ${w.humidity}%`,
      `🌬️ Wind: ${w.wind} km/h`,
      `☀️ UV: ${w.uvIndex}`,
    );
  }

  // Sensor AQI block
  if (aqi !== null) {
    const level = getAirLevelName(aqi);
    const advice = getHealthAdvice(aqi);
    parts.push(`📡 Sensor AQI: ${aqi} — ${level}`);
    if (advice) parts.push(`⚠️ ${advice}`);
  }

  const sep = '        •        ';
  const seg = parts.join(sep) + '                    ';
  textEl.textContent = seg + seg; // duplicate for seamless loop

  const color = (_tickerStatus?.color) ?? '#00e5ff';
  banner.style.setProperty('--alert-color', color);
  banner.style.borderLeftColor = color;
  banner.classList.remove('hidden'); // always visible
}

/* Called from fetchLatest every second */
function updateTicker(aqi, statusObj) {
  _tickerAqi = aqi;
  _tickerStatus = statusObj;
  rebuildTicker();
  fetchCityWeather(); // async, uses cache
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(fetchCityWeather, 600);
  window.addEventListener('locationUpdated', () => {
    _cityWeather = null; _weatherFetchedAt = 0;
    setTimeout(fetchCityWeather, 400);
  });
});

/* ================================================================
   CHART SETUP
================================================================ */
const FONT = "Rajdhani";
const TICK = "rgba(200,232,255,0.72)";
const GRID = "rgba(255,255,255,0.06)";

/* ── Device Status: 40-second offline detection ── */
let lastDataTime = 0;  // epoch ms of last successful data point

function checkDeviceTimeout() {
  if (!lastDataTime) return; // not received any data yet
  const elapsed = Date.now() - lastDataTime;
  const OFFLINE_AFTER = 40 * 1000; // 40 seconds
  if (elapsed > OFFLINE_AFTER) {
    const dot = document.getElementById('dspDot');
    const status = document.getElementById('dspStatus');
    if (dot) { dot.style.background = '#ff4d4d'; dot.style.boxShadow = '0 0 8px #ff4d4d'; }
    if (status) { status.textContent = 'Offline'; status.style.color = '#ff4d4d'; }
  }
}

setInterval(checkDeviceTimeout, 5000); // check every 5 s

let tempChart = null;
let airChart = null;

function makeLineChart(id, label, color, yMin, yMax, yStep) {
  const el = document.getElementById(id);
  if (!el) return null;
  const fill = color.replace("rgb(", "rgba(").replace(")", ",0.13)");
  return new Chart(el.getContext("2d"), {
    type: "line",
    data: {
      labels: [], datasets: [{
        label, borderColor: color, backgroundColor: fill,
        data: [], tension: 0.4, pointRadius: 1.5, pointHoverRadius: 6,
        pointBackgroundColor: color, fill: true, borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: false,   /* skip animation on live chart for instant scroll */
      plugins: {
        legend: { labels: { color: TICK, font: { family: FONT, size: 13 }, boxWidth: 26, padding: 12 } },
        tooltip: {
          mode: "index", intersect: false, backgroundColor: "rgba(6,16,30,0.93)",
          borderColor: color, borderWidth: 1, titleColor: TICK, bodyColor: "#fff",
          titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12
        },
      },
      scales: {
        x: { ticks: { color: TICK, maxTicksLimit: 10, maxRotation: 45, font: { family: FONT, size: 10 } }, grid: { color: GRID } },
        y: {
          min: yMin, max: yMax,
          ticks: { color: TICK, stepSize: yStep, maxTicksLimit: 16, font: { family: FONT, size: 10 } },
          grid: { color: GRID }
        },
      },
    },
  });
}

tempChart = makeLineChart("tempHumChart", "Temperature (°C)", "rgb(255,77,77)", -10, 60, 5);
airChart = makeLineChart("airChart", "Air Quality", "rgb(0,255,136)", 0, 500, 50);

/* ================================================================
   APPEND ONE POINT to the live sliding window
================================================================ */
function appendPoint(label, temp, hum, aqi) {
  const D = window.ENVDATA;
  if (D.labels.length > 0 && D.labels[D.labels.length - 1] === label) return false;
  D.labels.push(label); D.temps.push(temp); D.hums.push(hum); D.aqis.push(aqi);
  if (D.labels.length > MAX_PTS) { D.labels.shift(); D.temps.shift(); D.hums.shift(); D.aqis.shift(); }
  D.ready = true; D.backendOnline = true;
  return true;
}

/* ================================================================
   fetchLatest — every 1 second
================================================================ */
let _latestTs = "";

async function fetchLatest() {
  try {
    const res = await fetch(`${API_URL}/latest`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) { showOffline(); return; }
    const d = await res.json();
    if (!d) { showOffline(); return; }

    const temp = parseFloat(d.temperature);
    const hum = parseFloat(d.humidity);
    const aqi = parseFloat(d.air_quality);
    if (isNaN(temp) || isNaN(hum) || isNaN(aqi)) { showOffline(); return; }

    if (tempEl) tempEl.textContent = temp.toFixed(1) + " °C";
    if (humEl) humEl.textContent = hum.toFixed(1) + " %";
    if (airEl) airEl.textContent = aqi;

    const status = getAirStatus(aqi);
    if (airStatusEl) airStatusEl.textContent = status.text;
    if (airCard) airCard.style.boxShadow = `0 0 30px ${status.color}`;  /* data-driven, must stay in JS */

    /* ── News ticker: city weather + sensor AQI ── */
    updateTicker(aqi, status);

    if (tempGaugeValue) tempGaugeValue.textContent = temp.toFixed(1) + " °C";
    if (airGaugeValue) airGaugeValue.textContent = aqi;

    window.ENVDATA.latest = d;
    window.ENVDATA.backendOnline = true;

    /* ── Device Status Panel — check ESP data freshness ── */
    const dot = document.getElementById('dspDot');
    const dspStatus = document.getElementById('dspStatus');
    const dspLastData = document.getElementById('dspLastData');

    const dataAgeMs = d.created_at ? Date.now() - new Date(d.created_at).getTime() : Infinity;
    const DEVICE_STALE_MS = 40 * 1000; // 40 seconds

    if (dataAgeMs <= DEVICE_STALE_MS) {
      // Fresh data — ESP is Online
      lastDataTime = Date.now();
      if (dot) { dot.style.background = '#00ff88'; dot.style.boxShadow = '0 0 10px #00ff88'; }
      if (dspStatus) { dspStatus.textContent = 'Online'; dspStatus.style.color = '#00ff88'; }
      if (dspLastData && d.created_at) {
        dspLastData.textContent = new Date(d.created_at)
          .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    } else {
      // Stale data — ESP is Offline (backend alive but no new readings)
      if (dot) { dot.style.background = '#ff4d4d'; dot.style.boxShadow = '0 0 8px #ff4d4d'; }
      if (dspStatus) { dspStatus.textContent = 'Offline'; dspStatus.style.color = '#ff4d4d'; }
    }

    /* ── Alerts managed on alerts.html ── */

    const ts = d.created_at || new Date().toISOString();
    const label = new Date(ts).toLocaleTimeString("en-GB");
    appendPoint(label, temp, hum, aqi);

    const D = window.ENVDATA;
    if (tempChart && D.labels.length > 0) {
      tempChart.data.labels = D.labels;
      tempChart.data.datasets[0].data = D.temps;
      tempChart.update("none");
    }
    if (airChart && D.labels.length > 0) {
      airChart.data.labels = D.labels;
      airChart.data.datasets[0].data = D.aqis;
      airChart.update("none");
    }
  } catch (_) { showOffline(); }
}

/* ================================================================
   fetchHistory — every 10 seconds
================================================================ */
let _historyLastTs = "";

async function fetchHistory() {
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

      const slice = raw.slice(-MAX_PTS);
      const lastTs = slice[slice.length - 1]?.created_at || "";
      if (lastTs === _historyLastTs) break;
      _historyLastTs = lastTs;

      const labels = slice.map(d => new Date(d.created_at).toLocaleTimeString("en-GB"));
      const temps = slice.map(d => parseFloat(d.temperature));
      const hums = slice.map(d => parseFloat(d.humidity));
      const aqis = slice.map(d => parseFloat(d.air_quality));

      window.ENVDATA.labels = labels;
      window.ENVDATA.temps = temps;
      window.ENVDATA.hums = hums;
      window.ENVDATA.aqis = aqis;
      window.ENVDATA.ready = true;
      window.ENVDATA.backendOnline = true;

      if (tempChart) { tempChart.data.labels = labels; tempChart.data.datasets[0].data = temps; tempChart.update("none"); }
      if (airChart) { airChart.data.labels = labels; airChart.data.datasets[0].data = aqis; airChart.update("none"); }
      break;
    } catch (_) { continue; }
  }
}

/* ================================================================
   MODAL HELPERS
   Use CSS class "is-open" instead of style.display manipulation.
   Exposed on window so forecast.js / location.js can call them.
================================================================ */
window.openModal = function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("is-open");
  /* Trigger chart resize after transition */
  setTimeout(() => {
    if (id === "tempModal") window._modalResizeFn?.("tempModal");
    if (id === "humModal") window._modalResizeFn?.("humModal");
    if (id === "airModal") window._modalResizeFn?.("airModal");
  }, 60);
};

window.closeModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("is-open");
};

/* ================================================================
   EVENT WIRING — all handler that were formerly inline onclick=
   (located in index.html). Script runs with defer so DOM is ready.
================================================================ */
document.addEventListener("DOMContentLoaded", () => {

  /* Alert close button */
  document.getElementById("alertClose")?.addEventListener("click", () => {
    document.getElementById("alertBanner")?.classList.add("hidden");
  });

  /* Location badge → open locationModal */
  document.getElementById("locationBadge")?.addEventListener("click", () => {
    window.openModal("locationModal");
  });

  /* Fullscreen buttons */
  document.getElementById("masterFullscreenBtn")?.addEventListener("click", () => {
    window.openMasterModal?.();
  });
  document.getElementById("tempFullscreenBtn")?.addEventListener("click", () => {
    window.openModal("tempModal");
  });
  document.getElementById("humFullscreenBtn")?.addEventListener("click", () => {
    window.openModal("humModal");
  });
  document.getElementById("airFullscreenBtn")?.addEventListener("click", () => {
    window.openModal("airModal");
  });

  /* Modal backdrop + close buttons — delegate on all modals */
  document.querySelectorAll(".modal").forEach(modal => {
    /* Click on backdrop closes modal */
    modal.addEventListener("click", e => {
      if (e.target === modal) window.closeModal(modal.id);
    });
  });
  document.querySelectorAll(".close[data-modal]").forEach(btn => {
    btn.addEventListener("click", () => {
      window.closeModal(btn.dataset.modal);
    });
  });

  /* Escape key closes any open modal */
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal.is-open").forEach(m => window.closeModal(m.id));
    }
  });

});

/* ================================================================
   TIMERS
================================================================ */
setInterval(fetchLatest, 1000);
setInterval(fetchHistory, 10000);

fetchHistory();
setTimeout(fetchLatest, 500);