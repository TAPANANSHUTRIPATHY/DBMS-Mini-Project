// script.js — this is the main live data file for the homepage (index.html)
// it handles fetching the latest sensor reading every 1 second and updating the UI
// it also fetches the last 10 seconds of history to populate the live charts
// it also manages the news ticker, modal open/close, custom cursor, and footer

const API_URL = "https://dbms-mini-project-vgp4.onrender.com/api";  // our backend hosted on Render
const MAX_PTS = 40;  // how many data points to keep on the live charts at once (last 40 readings)

// expose the API URL so forecast.js can use it without hardcoding it again
window._ENVCORE_API_URL = API_URL;

// ENVDATA is a shared data bus — charts.js reads from this object every 1.5s
// instead of making charts.js do its own API calls, it just reads what script.js already fetched
window.ENVDATA = {
  labels: [],           // timestamps for the X-axis of charts
  temps: [],            // temperature values
  hums: [],             // humidity values
  aqis: [],             // air quality index values
  latest: null,         // the full latest DB row (used by other parts of the UI)
  ready: false,         // becomes true once we have at least one successful fetch
  backendOnline: false, // tracks whether the backend is reachable right now
};

// grab all the DOM elements we'll be updating frequently
// doing this once at the top is faster than calling getElementById every second
const tempEl = document.getElementById("temp");
const humEl = document.getElementById("hum");
const airEl = document.getElementById("air");
const airStatusEl = document.getElementById("airStatus");
const tempStatusEl = document.getElementById("tempStatus");
const humStatusEl = document.getElementById("humStatus");
const airCard = document.getElementById("airCard");
const tempGaugeValue = document.getElementById("tempGaugeValue");
const airGaugeValue = document.getElementById("airGaugeValue");

// converts a raw AQI number into a human-readable label and color
// based on standard AQI categories (Good → Hazardous)
function getAirStatus(v) {
  if (v <= 50) return { text: "🟢 Good", color: "#00ff88" };
  if (v <= 100) return { text: "🟡 Moderate", color: "#ffcc00" };
  if (v <= 150) return { text: "🟠 Unhealthy (Sensitive)", color: "#ff9900" };
  if (v <= 200) return { text: "🔴 Unhealthy", color: "#ff4d4d" };
  if (v <= 300) return { text: "🟣 Very Unhealthy", color: "#cc0099" };
  return { text: "🟤 Hazardous", color: "#800000" };
}

// when the backend stops responding, we show the device as Offline
// we don't wipe the sensor values — we keep the last known reading visible
function showOffline() {
  const dot = document.getElementById('dspDot');
  const status = document.getElementById('dspStatus');
  if (dot) { dot.style.background = '#ff4d4d'; dot.style.boxShadow = '0 0 8px #ff4d4d'; }
  if (status) status.textContent = 'Offline';
}

// ─────────────────────────────────────────────────────────────────────────────
// CITY WEATHER NEWS TICKER
// uses Open-Meteo API (completely free, no API key needed)
// the user's location is stored in localStorage so it persists between sessions
// ─────────────────────────────────────────────────────────────────────────────

// WMO weather codes → human readable labels (from the Open-Meteo docs)
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

// returns health advice text based on current AQI — shown in the news ticker
function getHealthAdvice(aqi) {
  if (aqi <= 50) return null;  // no advice needed when air is clean
  if (aqi <= 100) return 'Sensitive groups limit outdoor activity.';
  if (aqi <= 150) return 'Unhealthy for sensitive groups — keep windows closed.';
  if (aqi <= 200) return 'Unhealthy air — wear mask outdoors.';
  if (aqi <= 300) return 'Very unhealthy — avoid outdoor activities.';
  return 'HAZARDOUS — stay indoors, wear N95 mask.';
}

// same AQI but just returns the category name as a string (used in the ticker text)
function getAirLevelName(aqi) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

// cache the weather fetch so we don't hammer the Open-Meteo API every second
let _cityWeather = null;
let _weatherFetchedAt = 0;
const WEATHER_TTL = 10 * 60 * 1000; // only re-fetch weather every 10 minutes

async function fetchCityWeather() {
  // read saved location from localStorage, default to KIIT Bhubaneswar if nothing saved
  let lat = parseFloat(localStorage.getItem('user_lat'));
  let lon = parseFloat(localStorage.getItem('user_lon'));
  if (isNaN(lat) || isNaN(lon)) {
    lat = 20.3546;
    lon = 85.8164;
    localStorage.setItem('user_lat', lat);
    localStorage.setItem('user_lon', lon);
    localStorage.setItem('user_location', 'Bhubaneswar, Odisha, India');
  }

  // skip if we fetched recently (within TTL)
  if (Date.now() - _weatherFetchedAt < WEATHER_TTL && _cityWeather) return;
  try {
    // fetch current weather from Open-Meteo (free, no key, supports wind + UV + humidity)
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
    window.cityWeatherContext = _cityWeather;  // share with charts.js so it can drive the animated background
    _weatherFetchedAt = Date.now();
    rebuildTicker();  // update the ticker text with fresh weather data
  } catch (_) { }
}

// these hold the current AQI and status that should appear in the ticker
let _tickerAqi = null;
let _tickerStatus = null;

// rebuilds the ticker text content from the latest city weather + sensor AQI
// duplicates the segment so the CSS marquee animation loops seamlessly
function rebuildTicker() {
  const banner = document.getElementById('alertBanner');
  const textEl = document.getElementById('alertText');
  if (!banner || !textEl) return;

  const city = localStorage.getItem('user_location') || 'ENVCORE Station';
  const w = _cityWeather;
  const aqi = _tickerAqi;

  const parts = ['\u00a0\u00a0\u00a0\u00a0'];  // leading spaces for visual padding

  parts.push(`📍 ${city.split(',')[0].trim()}`);  // just the city name, not the full address

  // add weather info if we have it
  if (w) {
    parts.push(
      `${w.icon} ${w.condition}`,
      `🌡️ Temp: ${w.temp}°C`,
      `💧 Humidity: ${w.humidity}%`,
      `🌬️ Wind: ${w.wind} km/h`
    );
  }

  // add sensor AQI (from our ESP32) or "Sensor Offline" if no data
  if (aqi !== null) {
    const level = getAirLevelName(aqi);
    parts.push(`📡 Sensor AQI: ${aqi} — ${level}`);
  } else {
    parts.push(`📡 Sensor Offline`);
  }

  const sep = '        •        ';
  const seg = parts.join(sep) + '                    ';
  const newText = seg + seg;  // duplicate so the CSS scroll animation loops without a gap
  if (textEl.textContent !== newText) {
    textEl.textContent = newText;
  }

  // change the accent color of the ticker based on the AQI severity
  const color = (_tickerStatus?.color) ?? '#00e5ff';
  banner.style.setProperty('--alert-color', color);
  banner.style.borderLeftColor = color;
  banner.classList.remove('hidden');
}

// called from fetchLatest every second with the latest AQI reading + status object
function updateTicker(aqi, statusObj) {
  _tickerAqi = aqi;
  _tickerStatus = statusObj;
  rebuildTicker();
  fetchCityWeather();  // this internally checks the cache so it won't actually re-fetch unless 10 min passed
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(fetchCityWeather, 600);  // delay slightly so the page finishes loading first
  // if the user changes their location, clear the weather cache and refetch
  window.addEventListener('locationUpdated', () => {
    _cityWeather = null; _weatherFetchedAt = 0;
    setTimeout(fetchCityWeather, 400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHART SETUP — live scrolling line charts for temp and AQI
// ─────────────────────────────────────────────────────────────────────────────
const FONT = "Rajdhani";
const TICK = "rgba(200,232,255,0.72)";   // axis text color
const GRID = "rgba(255,255,255,0.06)";   // subtle grid lines

// this checks every 5 seconds if the ESP32 has gone silent
// if no new data in 6 minutes → mark device as offline
function updateSignalBars(state) {
  const barsContainer = document.getElementById('dspSignalBars');
  const valEl = document.getElementById('dspSignalVal');
  if (!barsContainer || !valEl) return;

  barsContainer.className = 'dsp-signal-bars';  // reset all signal bar CSS classes
  const bars = barsContainer.querySelectorAll('.sig-bar');
  bars.forEach(b => b.classList.remove('active'));

  if (state === 'bad') {
    barsContainer.classList.add('sig-bad');
    if (bars[0]) bars[0].classList.add('active');
    valEl.textContent = 'Bad';
    valEl.style.color = '#ff4d4d';
  } else if (state === 'good') {
    barsContainer.classList.add('sig-good');
    if (bars[0]) bars[0].classList.add('active');
    if (bars[1]) bars[1].classList.add('active');
    if (bars[2]) bars[2].classList.add('active');
    valEl.textContent = 'Good';
    valEl.style.color = '#ffcc00';
  } else if (state === 'excellent') {
    barsContainer.classList.add('sig-excellent');
    bars.forEach(b => b.classList.add('active'));
    valEl.textContent = 'Excellent';
    valEl.style.color = '#00ff88';
  }
}

let lastDataTime = 0;  // stores the epoch ms of the last time we got a valid reading

function checkDeviceTimeout() {
  if (!lastDataTime) {
    updateSignalBars('bad');  // never received any data
    return;
  }
  const elapsed = Date.now() - lastDataTime;
  const OFFLINE_AFTER = 6 * 60 * 1000;  // 6 minutes without data = treat as offline
  if (elapsed > OFFLINE_AFTER) {
    const dot = document.getElementById('dspDot');
    const status = document.getElementById('dspStatus');
    if (dot) { dot.style.background = '#ff4d4d'; dot.style.boxShadow = '0 0 8px #ff4d4d'; }
    if (status) { status.textContent = 'Offline'; status.style.color = '#ff4d4d'; }
    updateSignalBars('bad');
  }
}

setInterval(checkDeviceTimeout, 5000);  // run the check every 5 seconds

let tempChart = null;
let airChart = null;

// factory function to create a Chart.js line chart with our standard dark-theme styling
function makeLineChart(id, label, color, yMin, yMax, yStep) {
  const el = document.getElementById(id);
  if (!el) return null;
  const fill = color.replace("rgb(", "rgba(").replace(")", ",0.13)");  // semi-transparent fill under the line
  return new Chart(el.getContext("2d"), {
    type: "line",
    data: {
      labels: [], datasets: [{
        label, borderColor: color, backgroundColor: fill,
        data: [], tension: 0.4, pointRadius: 1.5, pointHoverRadius: 6,
        pointBackgroundColor: color, fill: true, borderWidth: 2, spanGaps: true
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: false,   // disable animation on the live chart so it scrolls smoothly without flickering
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

// create the two live charts — temp/humidity combined and AQI separately
tempChart = makeLineChart("tempHumChart", "Temperature (°C)", "rgb(255,77,77)", -10, 60, 5);
airChart = makeLineChart("airChart", "Air Quality", "rgb(0,255,136)", 0, 500, 50);

// ─────────────────────────────────────────────────────────────────────────────
// LIVE DATA WINDOW (append + scroll)
// ─────────────────────────────────────────────────────────────────────────────

// adds a new data point to the ENVDATA arrays and trims to MAX_PTS
// returns false and skips if the timestamp is the same as the last one (duplicate reading)
function appendPoint(label, temp, hum, aqi) {
  const D = window.ENVDATA;
  if (D.labels.length > 0 && D.labels[D.labels.length - 1] === label) return false;  // already have this timestamp
  D.labels.push(label); D.temps.push(temp); D.hums.push(hum); D.aqis.push(aqi);
  // keep only the last MAX_PTS readings — shift() removes the oldest from the front
  if (D.labels.length > MAX_PTS) { D.labels.shift(); D.temps.shift(); D.hums.shift(); D.aqis.shift(); }
  D.ready = true; D.backendOnline = true;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchLatest — runs every 1 second
// ─────────────────────────────────────────────────────────────────────────────
let _latestTs = "";  // stores the last seen timestamp to detect new readings

async function fetchLatest() {
  try {
    const res = await fetch(`${API_URL}/latest`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) { showOffline(); updateSignalBars('bad'); return; }
    const d = await res.json();
    if (!d) { showOffline(); updateSignalBars('bad'); return; }

    const temp = parseFloat(d.temperature);
    const hum = parseFloat(d.humidity);
    const aqi = parseFloat(d.air_quality);
    if (isNaN(temp) || isNaN(hum) || isNaN(aqi)) {
      updateSignalBars('good');  // backend is alive but returned incomplete data
      return;
    }

    // only show live values if the latest DB row is from today
    // if the ESP32 hasn't sent data today, show "--" so users don't see stale yesterday data
    const isToday = (d.created_at) && (new Date(d.created_at).setHours(0, 0, 0, 0) === new Date().setHours(0, 0, 0, 0));
    const status = getAirStatus(aqi);

    if (isToday) {
      if (tempEl) tempEl.textContent = temp.toFixed(1) + " \u00b0C";
      if (humEl) humEl.textContent = hum.toFixed(1) + " %";
      if (airEl) airEl.textContent = aqi;
      if (airStatusEl) airStatusEl.textContent = status.text;
      if (tempStatusEl) tempStatusEl.textContent = '';
      if (humStatusEl) humStatusEl.textContent = '';
      if (airCard) airCard.style.boxShadow = `0 0 30px ${status.color}`;  // glow color matches AQI severity

      updateTicker(aqi, status);  // update the news ticker with current sensor data

      if (tempGaugeValue) tempGaugeValue.textContent = temp.toFixed(1) + " \u00b0C";
      if (airGaugeValue) airGaugeValue.textContent = aqi;
    } else {
      // latest DB row is from a previous day — show "--" so it's clear no fresh data today
      if (tempEl) tempEl.textContent = '--';
      if (humEl) humEl.textContent = '--';
      if (airEl) airEl.textContent = '--';
      if (tempStatusEl) tempStatusEl.textContent = 'No Data Today';
      if (humStatusEl) humStatusEl.textContent = 'No Data Today';
      if (airStatusEl) airStatusEl.textContent = 'No Data Today';
      if (airCard) airCard.style.boxShadow = `0 0 30px rgba(255,255,255,0.1)`;
      updateTicker(null, null);
      if (tempGaugeValue) tempGaugeValue.textContent = '--';
      if (airGaugeValue) airGaugeValue.textContent = '--';
    }

    window.ENVDATA.latest = d;
    window.ENVDATA.backendOnline = true;

    // ── Device Status Panel — check how old the last reading is ──
    const dot = document.getElementById('dspDot');
    const dspStatus = document.getElementById('dspStatus');
    const dspLastData = document.getElementById('dspLastData');

    // format the timestamp of the last received reading nicely (e.g. "Thu 27 Mar 12:34:05")
    if (dspLastData && d.created_at) {
      const dt = new Date(d.created_at);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const mos = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      dspLastData.textContent = `${days[dt.getDay()]} ${dt.getDate()} ${mos[dt.getMonth()]} ` +
        dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // if data is more than 10 minutes old → ESP32 has gone silent → mark offline
    const dataAgeMs = d.created_at ? Date.now() - new Date(d.created_at).getTime() : Infinity;
    const DEVICE_STALE_MS = 10 * 60 * 1000;

    if (dataAgeMs <= DEVICE_STALE_MS) {
      lastDataTime = Date.now();  // record the last time we got fresh data (used by checkDeviceTimeout)
      if (dot) { dot.style.background = '#00ff88'; dot.style.boxShadow = '0 0 10px #00ff88'; }
      if (dspStatus) { dspStatus.textContent = 'Online'; dspStatus.style.color = '#00ff88'; }
      updateSignalBars('excellent');
    } else {
      // backend is alive but no new readings from the ESP32 in over 10 minutes
      if (dot) { dot.style.background = '#ff4d4d'; dot.style.boxShadow = '0 0 8px #ff4d4d'; }
      if (dspStatus) { dspStatus.textContent = 'Offline'; dspStatus.style.color = '#ff4d4d'; }
      updateSignalBars('bad');
    }

    // only append to charts if the data is from today
    if (isToday) {
      const ts = d.created_at || new Date().toISOString();
      const label = new Date(ts).toLocaleTimeString("en-GB");
      appendPoint(label, temp, hum, aqi);
    }

    // push the updated arrays into Chart.js and re-render (update("none") = no animation)
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

// ─────────────────────────────────────────────────────────────────────────────
// fetchHistory — runs every 10 seconds
// this pre-populates the charts with recent history so they're not empty on first load
// also syncs the ENVDATA bus for charts.js to read
// ─────────────────────────────────────────────────────────────────────────────
let _historyLastTs = "";  // used to skip re-rendering if nothing changed

async function fetchHistory() {
  const endpoints = [
    `${API_URL}/history?limit=10000`,  // try these URLs in order, stop at the first one that works
    `${API_URL}/history?all=true`,
    `${API_URL}/history`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const raw = await res.json();
      if (!Array.isArray(raw) || !raw.length) continue;

      // only keep the last MAX_PTS rows for the live charts
      const slice = raw.slice(-MAX_PTS);
      const lastTs = raw[raw.length - 1]?.created_at || "";
      if (lastTs === _historyLastTs) break;  // nothing new since last fetch, skip update
      _historyLastTs = lastTs;

      const todayMidnight = new Date().setHours(0, 0, 0, 0);
      const todaySlice = slice.filter(p => p.created_at && new Date(p.created_at).setHours(0, 0, 0, 0) === todayMidnight);

      // prefer today's data for the charts, but fall back to any recent data
      // so the sparklines and health ring don't look empty on days with no ESP32 data
      const useSlice = todaySlice.length > 0 ? todaySlice : slice;

      const labels = useSlice.map(d => new Date(d.created_at).toLocaleTimeString("en-GB"));
      const temps = useSlice.map(d => parseFloat(d.temperature));
      const hums = useSlice.map(d => parseFloat(d.humidity));
      const aqis = useSlice.map(d => parseFloat(d.air_quality));

      // update the shared ENVDATA object — charts.js will pick this up on its next sync tick
      window.ENVDATA.labels = labels;
      window.ENVDATA.temps = temps;
      window.ENVDATA.hums = hums;
      window.ENVDATA.aqis = aqis;
      window.ENVDATA.ready = true;
      window.ENVDATA.backendOnline = true;

      // only update the real-time line charts if the data is actually from today
      if (todaySlice.length > 0) {
        if (tempChart) { tempChart.data.labels = labels; tempChart.data.datasets[0].data = temps; tempChart.update("none"); }
        if (airChart) { airChart.data.labels = labels; airChart.data.datasets[0].data = aqis; airChart.update("none"); }
      }
      break;

    } catch (_) { continue; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL HELPERS
// modals use a CSS class "is-open" to show/hide rather than style.display
// this is better because CSS transitions work properly with classes
// openModal and closeModal are exposed on window so forecast.js and location.js can call them
// ─────────────────────────────────────────────────────────────────────────────
window.openModal = function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("is-open");
  // give the chart inside the modal a moment to render after the transition
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

// ─────────────────────────────────────────────────────────────────────────────
// DOM EVENT WIRING
// all the button clicks, modal triggers, keyboard shortcuts etc.
// we do this in DOMContentLoaded so the elements exist when we try to attach listeners
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  // close the alert/ticker banner
  document.getElementById("alertClose")?.addEventListener("click", () => {
    document.getElementById("alertBanner")?.classList.add("hidden");
  });

  // clicking the location badge at the top opens the location picker modal
  document.getElementById("locationBadge")?.addEventListener("click", () => {
    window.openModal("locationModal");
  });

  // fullscreen buttons — each opens a modal with a larger version of that chart
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

  // clicking the backdrop (the dark area behind the modal) should close it
  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", e => {
      if (e.target === modal) window.closeModal(modal.id);
    });
  });
  // also wire up the close (×) buttons inside each modal
  document.querySelectorAll(".close[data-modal]").forEach(btn => {
    btn.addEventListener("click", () => {
      window.closeModal(btn.dataset.modal);
    });
  });

  // pressing Escape closes any open modal
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal.is-open").forEach(m => window.closeModal(m.id));
    }
  });

  // ── Custom Glowing Cursor ──────────────────────────────────────────────────
  // replaces the default browser cursor with a custom neon dot + outer ring
  // uses requestAnimationFrame for smooth movement without jank
  const cursor = document.getElementById('customCursor');
  const cursorRing = document.getElementById('customCursorRing');

  if (cursor && cursorRing) {
    document.documentElement.style.cursor = 'none';  // hide the default cursor globally

    document.addEventListener('mousemove', (e) => {
      requestAnimationFrame(() => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
        // the ring follows the cursor with a slight lag (handled by CSS transition)
        cursorRing.style.left = `${e.clientX}px`;
        cursorRing.style.top = `${e.clientY}px`;
      });
    });

    // add a "clicking" class while mouse is held — triggers a scale animation in CSS
    document.addEventListener('mousedown', () => document.body.classList.add('cursor-clicking'));
    document.addEventListener('mouseup', () => document.body.classList.remove('cursor-clicking'));

    // use event delegation so dynamically added elements also get the hover effect
    const interactiveSelectors = 'a, button, input, .clickable, .close[data-modal], .loc-dd-item';
    document.body.addEventListener('mouseover', (e) => {
      if (e.target.closest(interactiveSelectors)) {
        document.body.classList.add('cursor-hovering');
      }
    });
    document.body.addEventListener('mouseout', (e) => {
      if (e.target.closest(interactiveSelectors)) {
        document.body.classList.remove('cursor-hovering');
      }
    });
  }

  // ── Footer Ticker ────────────────────────────────────────────────────────────
  // a scrolling marquee at the bottom showing project info + today's date
  // duplicated twice so the CSS animation loops without a gap (seamless loop trick)
  const footerTicker = document.getElementById('footerTickerInner');
  if (footerTicker) {
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();
    const dateStr = `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

    const segHtml = `
      <div class="ft-segment">
        Made with <span class="ft-heart">❤</span>
        <span class="ft-sep"></span>
        <span class="ft-author">Tapananshu Tripathy</span>
        <span class="ft-sep"></span>
        <span class="ft-date">✦ ${dateStr} ✦</span>
        <span class="ft-sep"></span>
        ENVCORE — Smart Environmental Monitoring
        <span class="ft-sep"></span>
        B.Tech CSE · KIIT University · Bhubaneswar
      </div>
    `;
    footerTicker.innerHTML = segHtml + segHtml;  // double it up for the seamless scroll loop
  }

});

// ─────────────────────────────────────────────────────────────────────────────
// POLLING INTERVALS
// fetchLatest runs every 1 second for live sensor values
// fetchHistory runs every 10 seconds to sync chart data from DB
// ─────────────────────────────────────────────────────────────────────────────
setInterval(fetchLatest, 1000);
setInterval(fetchHistory, 10000);

// run once immediately so there's data on screen right away, without waiting for the first interval
fetchHistory();
setTimeout(fetchLatest, 500);  // small delay so the page finishes painting before the first API call