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
const tempStatusEl = document.getElementById("tempStatus");
const humStatusEl = document.getElementById("humStatus");
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

/* ── Retain last values but show offline status ── */
function showOffline() {
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
  // If no user location is set, default to KIIT Bhubaneswar
  let lat = parseFloat(localStorage.getItem('user_lat'));
  let lon = parseFloat(localStorage.getItem('user_lon'));
  if (isNaN(lat) || isNaN(lon)) {
    lat = 20.3546;
    lon = 85.8164;
    localStorage.setItem('user_lat', lat);
    localStorage.setItem('user_lon', lon);
    localStorage.setItem('user_location', 'Bhubaneswar, Odisha, India');
  }

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
    window.cityWeatherContext = _cityWeather;
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
      `🌡️ Temp: ${w.temp}°C`,
      `💧 Humidity: ${w.humidity}%`,
      `🌬️ Wind: ${w.wind} km/h`
    );
  }

  // Sensor AQI block (Simplified Design)
  if (aqi !== null) {
    const level = getAirLevelName(aqi);
    parts.push(`📡 Sensor AQI: ${aqi} — ${level}`);
  } else {
    parts.push(`📡 Sensor Offline`);
  }

  const sep = '        •        ';
  const seg = parts.join(sep) + '                    ';
  const newText = seg + seg; // duplicate for seamless loop
  if (textEl.textContent !== newText) {
    textEl.textContent = newText;
  }

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
function updateSignalBars(state) {
  const barsContainer = document.getElementById('dspSignalBars');
  const valEl = document.getElementById('dspSignalVal');
  if (!barsContainer || !valEl) return;

  barsContainer.className = 'dsp-signal-bars'; // reset classes
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

let lastDataTime = 0;  // epoch ms of last successful data point

function checkDeviceTimeout() {
  if (!lastDataTime) {
    updateSignalBars('bad');
    return;
  }
  const elapsed = Date.now() - lastDataTime;
  const OFFLINE_AFTER = 6 * 60 * 1000; // 6 minutes
  if (elapsed > OFFLINE_AFTER) {
    const dot = document.getElementById('dspDot');
    const status = document.getElementById('dspStatus');
    if (dot) { dot.style.background = '#ff4d4d'; dot.style.boxShadow = '0 0 8px #ff4d4d'; }
    if (status) { status.textContent = 'Offline'; status.style.color = '#ff4d4d'; }
    updateSignalBars('bad');
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
        pointBackgroundColor: color, fill: true, borderWidth: 2, spanGaps: true
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
    if (!res.ok) { showOffline(); updateSignalBars('bad'); return; }
    const d = await res.json();
    if (!d) { showOffline(); updateSignalBars('bad'); return; }

    const temp = parseFloat(d.temperature);
    const hum = parseFloat(d.humidity);
    const aqi = parseFloat(d.air_quality);
    if (isNaN(temp) || isNaN(hum) || isNaN(aqi)) {
      updateSignalBars('good'); // Data is coming, but might be malformed/partial
      return;
    }

    const isToday = (d.created_at) && (new Date(d.created_at).setHours(0, 0, 0, 0) === new Date().setHours(0, 0, 0, 0));
    const status = getAirStatus(aqi);

    if (isToday) {
      if (tempEl) tempEl.textContent = temp.toFixed(1) + " \u00b0C";
      if (humEl) humEl.textContent = hum.toFixed(1) + " %";
      if (airEl) airEl.textContent = aqi;
      if (airStatusEl) airStatusEl.textContent = status.text;
      if (tempStatusEl) tempStatusEl.textContent = '';
      if (humStatusEl) humStatusEl.textContent = '';
      if (airCard) airCard.style.boxShadow = `0 0 30px ${status.color}`;  /* data-driven, must stay in JS */

      /* \u2500\u2500 News ticker: city weather + sensor AQI \u2500\u2500 */
      updateTicker(aqi, status);

      if (tempGaugeValue) tempGaugeValue.textContent = temp.toFixed(1) + " \u00b0C";
      if (airGaugeValue) airGaugeValue.textContent = aqi;
    } else {
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

    /* ── Device Status Panel — check ESP data freshness ── */
    const dot = document.getElementById('dspDot');
    const dspStatus = document.getElementById('dspStatus');
    const dspLastData = document.getElementById('dspLastData');

    if (dspLastData && d.created_at) {
      const dt = new Date(d.created_at);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const mos = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      dspLastData.textContent = `${days[dt.getDay()]} ${dt.getDate()} ${mos[dt.getMonth()]} ` +
        dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    const dataAgeMs = d.created_at ? Date.now() - new Date(d.created_at).getTime() : Infinity;
    const DEVICE_STALE_MS = 6 * 60 * 1000; // 6 minutes

    if (dataAgeMs <= DEVICE_STALE_MS) {
      // Fresh data — ESP is Online
      lastDataTime = Date.now();
      if (dot) { dot.style.background = '#00ff88'; dot.style.boxShadow = '0 0 10px #00ff88'; }
      if (dspStatus) { dspStatus.textContent = 'Online'; dspStatus.style.color = '#00ff88'; }
      updateSignalBars('excellent');
    } else {
      // Stale data — ESP is Offline (backend alive but no new readings)
      if (dot) { dot.style.background = '#ff4d4d'; dot.style.boxShadow = '0 0 8px #ff4d4d'; }
      if (dspStatus) { dspStatus.textContent = 'Offline'; dspStatus.style.color = '#ff4d4d'; }
      updateSignalBars('bad');
    }

    /* ── Alerts managed on alerts.html ── */

    if (isToday) {
      const ts = d.created_at || new Date().toISOString();
      const label = new Date(ts).toLocaleTimeString("en-GB");
      appendPoint(label, temp, hum, aqi);
    }

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
      const lastTs = raw[raw.length - 1]?.created_at || "";
      if (lastTs === _historyLastTs) break;
      _historyLastTs = lastTs;

      const todayMidnight = new Date().setHours(0, 0, 0, 0);
      const todaySlice = slice.filter(p => p.created_at && new Date(p.created_at).setHours(0, 0, 0, 0) === todayMidnight);

      const labels = todaySlice.map(d => new Date(d.created_at).toLocaleTimeString("en-GB"));
      const temps = todaySlice.map(d => parseFloat(d.temperature));
      const hums = todaySlice.map(d => parseFloat(d.humidity));
      const aqis = todaySlice.map(d => parseFloat(d.air_quality));

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

  /* ================================================================
     CUSTOM GLOWING CURSOR LOGIC
  ================================================================ */
  const cursor = document.getElementById('customCursor');
  const cursorRing = document.getElementById('customCursorRing');

  if (cursor && cursorRing) {
    // Hide default cursor over the entire document just in case
    document.documentElement.style.cursor = 'none';

    // Track mouse position
    document.addEventListener('mousemove', (e) => {
      // Use requestAnimationFrame for smoother performance
      requestAnimationFrame(() => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;

        // Add a slight delay/easing to the ring for a "following" effect
        // A simple approach is just locking it to the mouse with transition in CSS
        cursorRing.style.left = `${e.clientX}px`;
        cursorRing.style.top = `${e.clientY}px`;
      });
    });

    // Handle clicking animation
    document.addEventListener('mousedown', () => document.body.classList.add('cursor-clicking'));
    document.addEventListener('mouseup', () => document.body.classList.remove('cursor-clicking'));

    // Handle hovering over interactive elements
    const interactiveSelectors = 'a, button, input, .clickable, .close[data-modal], .loc-dd-item';

    // We use event delegation on body for dynamically added elements (like dropdowns)
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

  /* ================================================================
     FOOTER TICKER INIT
  ================================================================ */
  const footerTicker = document.getElementById('footerTickerInner');
  if (footerTicker) {
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();
    const dateStr = `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

    // Build one segment
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
    // Duplicate for seamless loop
    footerTicker.innerHTML = segHtml + segHtml;
  }

});

/* ================================================================
   TIMERS
================================================================ */
setInterval(fetchLatest, 1000);
setInterval(fetchHistory, 10000);

fetchHistory();
setTimeout(fetchLatest, 500);