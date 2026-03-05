/* ================================================================
   charts.js — ENVCORE UI Layer (loads after script.js)
   Reads window.ENVDATA set by script.js.
   Owns: humLineChart, humGauge, healthRing, modal charts,
         sparklines, animated bg, theme, clock, geo, alerts.
   KEY FIX: Only updates when backend is ONLINE (ENVDATA.ready).
            When offline: all values show "--", no stale data.
================================================================ */
(function () {
  "use strict";

  const FONT = "Rajdhani";
  const TICK = "rgba(200,232,255,0.72)";
  const GRID = "rgba(255,255,255,0.06)";
  const RED = "rgb(255,77,77)";
  const CYAN = "rgb(0,229,255)";
  const GREEN = "rgb(0,255,136)";

  const YR = {
    temp: { min: -10, max: 60, step: 5 },
    hum: { min: 0, max: 100, step: 5 },
    aqi: { min: 0, max: 500, step: 50 },
  };

  function rgba(c, a) { return c.replace("rgb(", "rgba(").replace(")", `,${a})`); }
  function ctx(id) { const e = document.getElementById(id); return e ? e.getContext("2d") : null; }
  function setEl(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

  function statsOf(arr) {
    if (!arr || !arr.length) return { min: "--", max: "--", avg: "--" };
    return {
      min: Math.min(...arr).toFixed(1),
      max: Math.max(...arr).toFixed(1),
      avg: (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1),
    };
  }

  /* ── Line chart factory ── */
  function makeLine(canvasId, label, color, yr) {
    const c = ctx(canvasId);
    if (!c) return null;
    return new Chart(c, {
      type: "line",
      data: {
        labels: [], datasets: [{
          label, borderColor: color,
          backgroundColor: rgba(color, 0.12), data: [], tension: 0.4,
          pointRadius: 2, pointHoverRadius: 7, pointBackgroundColor: color,
          fill: true, borderWidth: 2, spanGaps: true
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 400, easing: "easeInOutQuart" },
        plugins: {
          legend: { labels: { color: TICK, font: { family: FONT, size: 13 }, boxWidth: 26, padding: 12 } },
          tooltip: {
            mode: "index", intersect: false, backgroundColor: "rgba(6,16,30,0.93)",
            borderColor: color, borderWidth: 1, titleColor: TICK, bodyColor: "#fff",
            titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12
          },
        },
        scales: {
          x: { ticks: { color: TICK, maxTicksLimit: 12, maxRotation: 45, font: { family: FONT, size: 10 } }, grid: { color: GRID } },
          y: {
            min: yr.min, max: yr.max,
            ticks: { color: TICK, stepSize: yr.step, maxTicksLimit: 16, font: { family: FONT, size: 10 } },
            grid: { color: GRID }
          },
        },
      },
    });
  }

  function makeSpark(id, color) {
    const c = ctx(id);
    if (!c) return null;
    return new Chart(c, {
      type: "line",
      data: {
        labels: [], datasets: [{
          data: [], borderColor: color,
          backgroundColor: rgba(color, 0.1), borderWidth: 1.5, pointRadius: 0, fill: true, tension: 0.4,
          spanGaps: true
        }]
      },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } }
      },
    });
  }

  /* ── Chart instances ── */
  const humLineChart = makeLine("humLineChart", "Humidity (%)", CYAN, YR.hum);
  const tempLargeChart = makeLine("tempLargeCanvas", "Temperature (°C)", RED, YR.temp);
  const humLargeChart = makeLine("humLargeCanvas", "Humidity (%)", CYAN, YR.hum);
  const airLargeChart = makeLine("airLargeCanvas", "Air Quality", GREEN, YR.aqi);

  const healthChart = ctx("healthRing") ? new Chart(ctx("healthRing"), {
    type: "doughnut",
    data: {
      datasets: [{
        data: [33, 33, 34],
        backgroundColor: ["rgba(255,77,77,0.15)", "rgba(0,229,255,0.15)", "rgba(0,255,136,0.15)"],
        borderColor: ["rgba(255,77,77,0.7)", "rgba(0,229,255,0.7)", "rgba(0,255,136,0.7)"],
        borderWidth: 2
      }]
    },
    options: {
      cutout: "75%", plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: { duration: 900 }
    },
  }) : null;

  const tempSpk = makeSpark("tempSparkline", RED);
  const humSpk = makeSpark("humSparkline", CYAN);
  const airSpk = makeSpark("airSparkline", GREEN);

  /* ── Mirror helper ── */
  function mirror(chart, labels, data) {
    if (!chart || !labels || !labels.length) return;
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update("none");
  }

  /* ── Reset all charts to empty when backend goes offline ── */
  function clearAllCharts() {
    [humLineChart, tempLargeChart, humLargeChart, airLargeChart,
      tempSpk, humSpk, airSpk].forEach(ch => {
        if (!ch) return;
        ch.data.labels = [];
        ch.data.datasets[0].data = [];
        ch.update("none");
      });
    ["tempMin", "tempAvg", "tempMax", "humMin", "humAvg", "humMax", "airMin", "airAvg", "airMax",
      "tTempMin", "tTempAvg", "tTempMax", "tHumMin", "tHumAvg", "tHumMax", "tAqiMin", "tAqiAvg", "tAqiMax",
      "healthScore", "healthGrade", "hlTemp", "hlHum", "hlAqi"].forEach(id => setEl(id, "--"));
  }

  /* ================================================================
     HEALTH RING (Customizable via localStorage)
  ================================================================ */
  function updateHealth(temp, hum, aqi) {
    const idealTemp = parseFloat(localStorage.getItem("ideal_temp")) || 22;
    const idealHum = parseFloat(localStorage.getItem("ideal_hum")) || 50;
    const maxAqi = parseFloat(localStorage.getItem("max_aqi")) || 500;

    // Formulas:
    // Temp drops 4 points per 1°C from ideal
    // Hum drops 2 points per 1% from ideal
    // AQI drops linearly to 0 at maxAqi
    const ts = Math.max(0, 100 - Math.abs(temp - idealTemp) * 4);
    const hs = Math.max(0, 100 - Math.abs(hum - idealHum) * 2);
    const as = Math.max(0, 100 - (aqi / maxAqi) * 100);
    const score = Math.round((ts + hs + as) / 3);
    setEl("healthScore", score);

    let grade = "--", col = "#00e5ff";
    if (score >= 80) { grade = "EXCELLENT"; col = "#00ff88"; }
    else if (score >= 60) { grade = "GOOD"; col = "#00e5ff"; }
    else if (score >= 40) { grade = "MODERATE"; col = "#ffcc00"; }
    else { grade = "POOR"; col = "#ff4d4d"; }

    const gEl = document.getElementById("healthGrade");
    if (gEl) { gEl.textContent = grade; gEl.style.color = col; }

    if (healthChart) {
      healthChart.data.datasets[0].data = [ts, hs, as];
      healthChart.data.datasets[0].borderColor = [
        `rgba(255,77,77,${0.4 + ts / 200})`, `rgba(0,229,255,${0.4 + hs / 200})`, `rgba(0,255,136,${0.4 + as / 200})`,
      ];
      healthChart.data.datasets[0].backgroundColor = [
        `rgba(255,77,77,${0.06 + ts / 400})`, `rgba(0,229,255,${0.06 + hs / 400})`, `rgba(0,255,136,${0.06 + as / 400})`,
      ];
      healthChart.update("none");
    }

    // Set legend values back to calculated sub-scores for "Health Score breakdown" 
    setEl("hlTemp", Math.round(ts));
    setEl("hlHum", Math.round(hs));
    setEl("hlAqi", Math.round(as));

    // Update tooltips to explain the "ideal" value being used
    const elTemp = document.getElementById("hlTemp");
    const elHum = document.getElementById("hlHum");
    const elAqi = document.getElementById("hlAqi");
    if (elTemp) elTemp.title = `Score out of 100 based on Ideal Temp: ${idealTemp}°C`;
    if (elHum) elHum.title = `Score out of 100 based on Ideal Humidity: ${idealHum}%`;
    if (elAqi) elAqi.title = `Score out of 100 based on Max AQI tolerance: ${maxAqi}`;
  }

  /* ================================================================
     CARD BG + BARS
  ================================================================ */
  function updateCards(temp, hum, aqi) {
    const th = Math.round(220 - Math.min(Math.max(temp, 0), 50) / 50 * 220);
    const tb = document.querySelector(".temp-bg");
    if (tb) tb.style.background = `radial-gradient(circle at 30% 50%,hsla(${th},100%,55%,.18),transparent 70%)`;
    const hh = Math.round(30 + Math.min(Math.max(hum, 0), 100) / 100 * 170);
    const hb = document.querySelector(".hum-bg");
    if (hb) hb.style.background = `radial-gradient(circle at 70% 40%,hsla(${hh},100%,55%,.18),transparent 70%)`;
    const tBar = document.getElementById("tempBar");
    const hBar = document.getElementById("humBar");
    const aBar = document.getElementById("airBar");
    if (tBar) tBar.style.width = `${Math.min(Math.max((temp + 10) / 70 * 100, 0), 100)}%`;
    if (hBar) hBar.style.width = `${Math.min(Math.max(hum, 0), 100)}%`;
    if (aBar) aBar.style.width = `${Math.min(aqi / 500 * 100, 100)}%`;
  }

  /* ================================================================
     ALERTS
  ================================================================ */
  let _lastAlert = 0;
  function checkAlerts(temp, hum, aqi) {
    if (Date.now() - _lastAlert < 15000) return;
    const msgs = [];
    if (temp > 35) msgs.push(`🌡 Temperature critical: ${temp}°C`);
    if (temp < 5) msgs.push(`🌡 Temperature very low: ${temp}°C`);
    if (hum > 85) msgs.push(`💧 Humidity very high: ${hum}%`);
    if (hum < 20) msgs.push(`💧 Humidity very low: ${hum}%`);
    if (aqi > 300) msgs.push(`🌫 Air quality HAZARDOUS: AQI ${aqi}`);
    else if (aqi > 150) msgs.push(`🌫 Air quality UNHEALTHY: AQI ${aqi}`);
    if (!msgs.length) return;
    const b = document.getElementById("alertBanner");
    const t = document.getElementById("alertText");
    if (b && t) { t.textContent = msgs[0]; b.classList.remove("hidden"); _lastAlert = Date.now(); }
  }

  /* ================================================================
     MAIN SYNC — polls ENVDATA every 1.5s
  ================================================================ */
  let _lastSyncTs = "";
  let _syncCount = 0;

  function sync() {
    _syncCount++;
    const D = window.ENVDATA;

    /* Data not ready yet */
    if (!D || !D.ready) {
      return;
    }

    const lastTs = D.labels[D.labels.length - 1];
    /* Always sync humidity + gauges + health even if no new point.
       Only skip the heavy mirror() calls when truly nothing changed. */
    const hasNew = (lastTs !== _lastSyncTs);
    if (hasNew) _lastSyncTs = lastTs;

    const { labels, temps, hums, aqis } = D;
    const latestTemp = temps[temps.length - 1];
    const latestHum = hums[hums.length - 1];
    const latestAqi = aqis[aqis.length - 1];

    if (isNaN(latestTemp) || isNaN(latestHum) || isNaN(latestAqi)) return;

    /* Always redraw charts so they don't vanish or break randomly when backend is quiet. */
    mirror(humLineChart, labels, hums);
    mirror(tempLargeChart, labels, temps);
    mirror(humLargeChart, labels, hums);
    mirror(airLargeChart, labels, aqis);
    mirror(tempSpk, labels, temps);
    mirror(humSpk, labels, hums);
    mirror(airSpk, labels, aqis);

    /* Health ring — MUST be called every sync */
    updateHealth(latestTemp, latestHum, latestAqi);

    /* Card backgrounds + bars */
    updateCards(latestTemp, latestHum, latestAqi);

    /* Stats badges — always refresh */
    const ts = statsOf(temps), hs = statsOf(hums), as = statsOf(aqis);
    ["Min", "Avg", "Max"].forEach((k, i) => {
      setEl("temp" + k, [ts.min, ts.avg, ts.max][i]);
      setEl("hum" + k, [hs.min, hs.avg, hs.max][i]);
      setEl("air" + k, [as.min, as.avg, as.max][i]);
      setEl("tTemp" + k, [ts.min, ts.avg, ts.max][i]);
      setEl("tHum" + k, [hs.min, hs.avg, hs.max][i]);
      setEl("tAqi" + k, [as.min, as.avg, as.max][i]);
    });

    checkAlerts(latestTemp, latestHum, latestAqi);

    /* Smart Recommendations */
    updateRecommendations(latestTemp, latestHum, latestAqi);
  }

  /* ================================================================
     SMART RECOMMENDATIONS ENGINE 🤖
     Rule-based toast popup system — fires when conditions change
  ================================================================ */
  let _lastRecoKey = "";
  let _lastRecoTime = 0;
  const RECO_COOLDOWN = 30000; /* only re-fire toasts every 30s if conditions unchanged */

  function showToast(icon, text, severity) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    /* Limit to 4 toasts max visible */
    while (container.children.length >= 4) {
      container.removeChild(container.firstChild);
    }

    const toast = document.createElement("div");
    toast.className = `env-toast toast-${severity}`;
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-msg">${text}</span>
      <button class="toast-close" onclick="this.parentElement.classList.add('toast-exit');setTimeout(()=>this.parentElement.remove(),350)">✕</button>
      <div class="toast-progress"></div>
    `;
    container.appendChild(toast);

    /* Auto-remove after 8s */
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add("toast-exit");
        setTimeout(() => toast.remove(), 350);
      }
    }, 8000);
  }

  function updateRecommendations(temp, hum, aqi) {
    const tips = [];

    /* ── AQI-based rules ── */
    if (aqi > 300) {
      tips.push({ icon: "🚨", text: "HAZARDOUS air! Stay indoors, seal windows and doors.", severity: "critical" });
      tips.push({ icon: "😷", text: "Wear N95 mask if you must go outside.", severity: "critical" });
    } else if (aqi > 200) {
      tips.push({ icon: "🔴", text: "Very unhealthy — avoid outdoor activities. Turn on purifier.", severity: "danger" });
    } else if (aqi > 150) {
      tips.push({ icon: "🟠", text: "Unhealthy air — close windows, wear mask outdoors.", severity: "warning" });
    } else if (aqi > 100) {
      tips.push({ icon: "🟡", text: "Moderate air — sensitive groups limit outdoor exposure.", severity: "info" });
    }

    /* ── Temperature-based rules ── */
    if (temp > 40) {
      tips.push({ icon: "🥵", text: `Extreme heat (${temp.toFixed(1)}°C)! Stay hydrated, avoid sun.`, severity: "critical" });
    } else if (temp > 35) {
      tips.push({ icon: "🌡️", text: `High temp (${temp.toFixed(1)}°C) — drink water frequently.`, severity: "warning" });
    } else if (temp < 5) {
      tips.push({ icon: "🥶", text: `Very cold (${temp.toFixed(1)}°C) — wear warm layers.`, severity: "warning" });
    }

    /* ── Humidity-based rules ── */
    if (hum > 85) {
      tips.push({ icon: "💧", text: `High humidity (${hum.toFixed(1)}%) — mold risk, use dehumidifier.`, severity: "warning" });
    } else if (hum < 20) {
      tips.push({ icon: "🏜️", text: `Very dry (${hum.toFixed(1)}%) — use humidifier, stay hydrated.`, severity: "warning" });
    }

    /* ── Combined rules ── */
    if (temp > 30 && hum > 70) {
      tips.push({ icon: "⚠️", text: "Heat + humidity combo — dangerous heat index!", severity: "danger" });
    }

    /* Only fire toasts if conditions changed or cooldown expired */
    const key = tips.map(t => t.severity + t.icon).join("|");
    const now = Date.now();
    if (key === _lastRecoKey && (now - _lastRecoTime) < RECO_COOLDOWN) return;
    _lastRecoKey = key;
    _lastRecoTime = now;

    /* Fire toast for each tip (staggered) */
    tips.forEach((t, i) => {
      setTimeout(() => showToast(t.icon, t.text, t.severity), i * 400);
    });
  }

  setInterval(sync, 1000);  /* match 1s fetchLatest interval */
  setTimeout(sync, 600);

  /* ================================================================
     MODALS — resize charts on open; open/close owned by script.js
  ================================================================ */
  /* Register chart resize callbacks for script.js to trigger */
  window._modalResizeFn = function (id) {
    if (id === "tempModal" && tempLargeChart) tempLargeChart.resize();
    if (id === "humModal" && humLargeChart) humLargeChart.resize();
    if (id === "airModal" && airLargeChart) airLargeChart.resize();
  };

  /* ================================================================
     CLOCK
  ================================================================ */
  (function tick() {
    const el = document.getElementById("clockDisplay");
    if (el) el.textContent = new Date().toLocaleTimeString("en-GB");
    setTimeout(tick, 1000);
  })();

  /* ================================================================
     THEME TOGGLE
  ================================================================ */
  document.getElementById("themeToggle")?.addEventListener("click", function () {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
    this.classList.toggle("light-mode", dark);
  });

  /* ================================================================
     ANIMATED BACKGROUND
  ================================================================ */
  (function animBg() {
    const cv = document.getElementById("bgCanvas");
    if (!cv) return;
    const bx = cv.getContext("2d");
    let W, H;
    function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
    resize();
    window.addEventListener("resize", resize);

    /* ── Self-fetching weather context for dashboard/alerts pages ── */
    /* This mirrors script.js fetchCityWeather so all pages get live weather */
    const WMO_LABELS = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Fog', 48: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
      61: 'Rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Snow', 73: 'Snow', 75: 'Heavy snow',
      80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Snow showers',
      95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm'
    };
    const WMO_ICONS = {
      0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️',
      53: '🌦️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️', 71: '❄️', 73: '❄️', 75: '❄️',
      95: '⛈️', 96: '⛈️', 99: '⛈️'
    };

    if (!window.cityWeatherContext) {
      const lat = parseFloat(localStorage.getItem('user_lat')) || 20.35;
      const lon = parseFloat(localStorage.getItem('user_lon')) || 85.82;
      const today = new Date().toISOString().slice(0, 10);
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relative_humidity_2m&daily=sunrise,sunset&wind_speed_unit=kmh&timezone=auto&start_date=${today}&end_date=${today}`)
        .then(r => r.json())
        .then(data => {
          const cw = data?.current_weather;
          if (!cw) return;
          const code = cw.weathercode ?? 0;
          const srStr = data?.daily?.sunrise?.[0];
          const ssStr = data?.daily?.sunset?.[0];
          window.cityWeatherContext = {
            condition: WMO_LABELS[code] || 'Clear sky',
            icon: WMO_ICONS[code] || '🌤️',
            temp: Math.round(cw.temperature ?? 25),
            wind: Math.round(cw.windspeed ?? 5),
            humidity: data?.hourly?.relative_humidity_2m?.[new Date().getHours()] ?? 60,
            sunriseMs: srStr ? new Date(srStr).getTime() : null,
            sunsetMs: ssStr ? new Date(ssStr).getTime() : null,
          };
        })
        .catch(() => {
          /* fallback — Bhubaneswar averages */
          window.cityWeatherContext = { condition: 'Clear sky', icon: '☀️', temp: 25, wind: 5, humidity: 60, sunriseMs: null, sunsetMs: null };
        });
      /* Immediately set a default so the bg loop starts with something */
      window.cityWeatherContext = window.cityWeatherContext || { condition: 'Clear sky', icon: '☀️', temp: 25, wind: 5, humidity: 60, sunriseMs: null, sunsetMs: null };
    }


    const DOTS = Array.from({ length: 65 }, () => ({
      x: Math.random() * 1920, y: Math.random() * 1080,
      vx: (Math.random() - .5) * .18, vy: (Math.random() - .5) * .18,
      r: Math.random() * 1.3 + .35, a: Math.random() * .4 + .15,
    }));

    const TYPES = ["drop", "drop", "drop", "therm", "ring", "ring", "hex", "dot"];
    function newSym() {
      return {
        t: TYPES[Math.floor(Math.random() * TYPES.length)],
        x: Math.random() * 1920, y: H + 50 + Math.random() * 200,
        vx: (Math.random() - .5) * .1, vy: -(Math.random() * .3 + .08),
        sz: Math.random() * 13 + 5, life: 0, maxLife: Math.random() * 700 + 250,
        hue: [180, 190, 160, 200, 130][Math.floor(Math.random() * 5)]
      };
    }
    const SYMS = Array.from({ length: 40 }, () => {
      const s = newSym(); s.y = Math.random() * H; s.life = Math.random() * s.maxLife; return s;
    });

    /* ── Stunning Weather Elements ── */
    // Multi-layer rain for parallax effect
    const RAIN_DROPS = Array.from({ length: 250 }, () => {
      const z = Math.random() * 3 + 1; // 1 to 4 depth
      return {
        x: Math.random() * 1920,
        y: Math.random() * 1080,
        z: z,
        len: Math.random() * 15 * z + 10,
        vy: (Math.random() * 5 + 10) * z,
        vx: (Math.random() - 0.5) * z * 1.5,
        a: Math.random() * 0.2 + 0.1 * z
      };
    });

    // Smooth, deep clouds
    const CLOUDS = Array.from({ length: 8 }, () => {
      const scale = Math.random() * 1.5 + 0.5;
      return {
        x: Math.random() * 1920,
        y: Math.random() * Math.max(H * 0.4, 300) - 50,
        size: 70 * scale,
        vx: (Math.random() * 0.3 + 0.1) * scale,
        a: Math.random() * 0.2 + 0.05
      };
    });

    let sunRotation = 0;
    let lightningFlash = 0;

    function drawDrop(x, y, sz, a, hue) { bx.save(); bx.translate(x, y); bx.globalAlpha = a; bx.strokeStyle = `hsl(${hue},90%,65%)`; bx.lineWidth = .9; bx.shadowColor = `hsl(${hue},90%,65%)`; bx.shadowBlur = 7; bx.beginPath(); bx.moveTo(0, -sz); bx.bezierCurveTo(sz * .85, -sz * .15, sz * .85, sz * .5, 0, sz * .82); bx.bezierCurveTo(-sz * .85, sz * .5, -sz * .85, -sz * .15, 0, -sz); bx.stroke(); bx.restore(); }
    function drawTherm(x, y, sz, a) { bx.save(); bx.translate(x, y); bx.globalAlpha = a; bx.strokeStyle = `rgba(255,110,80,${a})`; bx.lineWidth = 1.1; bx.shadowColor = "#ff4d4d"; bx.shadowBlur = 6; bx.beginPath(); bx.moveTo(-sz * .17, -sz); bx.lineTo(sz * .17, -sz); bx.lineTo(sz * .17, sz * .35); bx.lineTo(-sz * .17, sz * .35); bx.closePath(); bx.stroke(); bx.beginPath(); bx.arc(0, sz * .5, sz * .3, 0, 6.28); bx.fillStyle = `rgba(255,77,77,${a * .55})`; bx.fill(); bx.restore(); }
    function drawRing(x, y, sz, a, hue) { bx.save(); bx.translate(x, y); bx.globalAlpha = a; bx.strokeStyle = `hsl(${hue},90%,60%)`; bx.lineWidth = .8; bx.shadowColor = `hsl(${hue},90%,60%)`; bx.shadowBlur = 9; bx.beginPath(); bx.arc(0, 0, sz, 0, 6.28); bx.stroke(); bx.globalAlpha = a * .4; bx.beginPath(); bx.arc(0, 0, sz * .5, 0, 6.28); bx.stroke(); for (let i = 0; i < 6; i++) { const ang = i / 6 * 6.28; bx.globalAlpha = a * .6; bx.beginPath(); bx.arc(Math.cos(ang) * sz, Math.sin(ang) * sz, sz * .1, 0, 6.28); bx.fillStyle = `hsl(${hue},90%,70%)`; bx.fill(); } bx.restore(); }
    function drawHex(x, y, sz, a) { bx.save(); bx.translate(x, y); bx.globalAlpha = a * .3; bx.strokeStyle = "rgba(0,229,255,1)"; bx.lineWidth = .6; bx.beginPath(); for (let i = 0; i < 6; i++) { const ang = i / 6 * 6.28 - Math.PI / 6; i ? bx.lineTo(Math.cos(ang) * sz, Math.sin(ang) * sz) : bx.moveTo(Math.cos(ang) * sz, Math.sin(ang) * sz); } bx.closePath(); bx.stroke(); bx.restore(); }
    function drawDot(x, y, sz, a, hue) { bx.save(); bx.globalAlpha = a; bx.beginPath(); bx.arc(x, y, sz * .22, 0, 6.28); bx.fillStyle = `hsl(${hue},90%,65%)`; bx.shadowColor = `hsl(${hue},90%,65%)`; bx.shadowBlur = sz * 1.6; bx.fill(); bx.restore(); }

    let hp = 0;
    function hexGrid() {
      hp += .004;
      const gs = 72, cols = Math.ceil(W / (gs * 1.5)) + 2, rows = Math.ceil(H / (gs * .866)) + 2;
      bx.save(); bx.globalAlpha = .016 + Math.sin(hp) * .005; bx.strokeStyle = "#00e5ff"; bx.lineWidth = .5;
      for (let col = -1; col < cols; col++) for (let row = -1; row < rows; row++) {
        const cx = col * gs * 1.5, cy = row * gs * .866 + (col % 2 ? gs * .433 : 0);
        bx.beginPath();
        for (let i = 0; i < 6; i++) { const ang = i / 6 * 6.28 - Math.PI / 6; const px = cx + Math.cos(ang) * gs * .47, py = cy + Math.sin(ang) * gs * .47; i ? bx.lineTo(px, py) : bx.moveTo(px, py); }
        bx.closePath(); bx.stroke();
      }
      bx.restore();
    }

    function drawWeather(condStr, lightMode) {
      if (!condStr) condStr = 'clear sky';
      condStr = condStr.toLowerCase();

      const isRainy = condStr.includes('rain') || condStr.includes('drizzle') || condStr.includes('shower');
      const isCloudy = condStr.includes('cloud') || condStr.includes('overcast') || isRainy || condStr.includes('partly') || condStr.includes('mainly');
      const isStormy = condStr.includes('thunder') || condStr.includes('storm');

      /* ── True Day/Night using sunrise/sunset from API ── */
      const srMs = window.cityWeatherContext?.sunriseMs;
      const ssMs = window.cityWeatherContext?.sunsetMs;
      const nowMs = Date.now();
      let isNight;
      if (srMs && ssMs) {
        isNight = nowMs < srMs || nowMs > ssMs;
      } else {
        const h = new Date().getHours();
        isNight = h >= 19 || h < 6;
      }
      const isDaytime = !isNight;

      /* Cloud opacity scales with weather — thinner when clear, denser when cloudy */
      const cloudAlphaMultiplier = isCloudy ? 1.0 : 0.25;

      // 1) Lightning Flash Background (Bottom Layer of Weather)
      if (isStormy && Math.random() < 0.005) lightningFlash = 1;
      if (lightningFlash > 0) {
        bx.save();
        bx.fillStyle = `rgba(255, 255, 255, ${lightningFlash * 0.3})`;
        bx.fillRect(0, 0, W, H);
        bx.restore();
        lightningFlash -= 0.05;
      }

      // 2a) The Astonishing Sun (Always visible during daytime)
      if (isDaytime) {
        bx.save();
        const sunX = W * 0.85;
        const sunY = H * 0.2;

        /* Sun dims slightly behind clouds */
        const sunAlpha = isCloudy ? 0.55 : 1.0;
        bx.globalAlpha = sunAlpha;

        sunRotation += 0.0015;
        bx.translate(sunX, sunY);
        bx.rotate(sunRotation);

        // Intense Sun Glow
        const glow = bx.createRadialGradient(0, 0, 30, 0, 0, 320);
        if (lightMode) {
          glow.addColorStop(0, 'rgba(255, 220, 50, 0.9)');
          glow.addColorStop(0.3, 'rgba(255, 180, 0, 0.35)');
          glow.addColorStop(1, 'transparent');
        } else {
          glow.addColorStop(0, 'rgba(255, 210, 0, 0.75)');
          glow.addColorStop(0.4, 'rgba(255, 100, 0, 0.18)');
          glow.addColorStop(1, 'transparent');
        }

        bx.beginPath();
        bx.arc(0, 0, 320, 0, 6.28);
        bx.fillStyle = glow;
        bx.fill();

        // Solid Core
        bx.shadowColor = lightMode ? '#ffcc00' : '#ffaa00';
        bx.shadowBlur = 50;
        bx.fillStyle = lightMode ? '#ffdf00' : '#ffc400';
        bx.beginPath();
        bx.arc(0, 0, 48, 0, 6.28);
        bx.fill();

        // Graceful Rays
        bx.strokeStyle = lightMode ? 'rgba(255, 200, 0, 0.65)' : 'rgba(255, 180, 0, 0.45)';
        bx.lineWidth = 6;
        bx.lineCap = 'round';
        bx.globalAlpha = sunAlpha * 0.9;
        for (let i = 0; i < 12; i++) {
          bx.rotate(6.28 / 12);
          bx.beginPath();
          bx.moveTo(62, 0);
          bx.lineTo(105 + Math.sin(sunRotation * 30 + i) * 16, 0);
          bx.stroke();
        }
        bx.restore();
      }

      // 2b) The Glowing Moon + Stars (Always visible at night)
      if (isNight) {
        /* ── Twinkling Stars ── */
        bx.save();
        bx.globalAlpha = isCloudy ? 0.08 : 0.35;
        for (let si = 0; si < 120; si++) {
          /* deterministic star positions using si as seed */
          const sx = ((si * 2971) % 1000) / 1000 * W;
          const sy = ((si * 1847) % 700) / 700 * H * 0.8;
          const sr2 = ((si * 3583) % 10) / 10 * 1.4 + 0.3;
          /* flicker */
          const flicker = 0.6 + 0.4 * Math.sin(Date.now() * 0.001 + si * 0.7);
          bx.globalAlpha = (isCloudy ? 0.05 : 0.28) * flicker;
          bx.fillStyle = '#ffffff';
          bx.shadowColor = '#c8e8ff';
          bx.shadowBlur = sr2 * 6;
          bx.beginPath();
          bx.arc(sx, sy, sr2, 0, 6.28);
          bx.fill();
        }
        bx.restore();

        /* ── Crescent Moon ── */
        bx.save();
        const moonX = W * 0.85;
        const moonY = H * 0.2;
        const moonAlpha = isCloudy ? 0.45 : 1.0;

        bx.translate(moonX, moonY);

        // Soft lunar glow
        const moonGlow = bx.createRadialGradient(0, 0, 20, 0, 0, 280);
        const glowColor = '200, 232, 255';
        moonGlow.addColorStop(0, `rgba(${glowColor}, ${0.55 * moonAlpha})`);
        moonGlow.addColorStop(0.4, `rgba(${glowColor}, ${0.12 * moonAlpha})`);
        moonGlow.addColorStop(1, 'transparent');

        bx.beginPath();
        bx.arc(0, 0, 280, 0, 6.28);
        bx.fillStyle = moonGlow;
        bx.fill();

        bx.shadowColor = `rgba(${glowColor}, 0.9)`;
        bx.shadowBlur = 40;
        bx.globalAlpha = moonAlpha;
        bx.fillStyle = '#e8f4ff';
        bx.beginPath();
        bx.arc(0, 0, 44, 0, 6.28);
        bx.fill();

        // Carve out crescent shadow
        bx.globalCompositeOperation = 'destination-out';
        bx.globalAlpha = 1;
        bx.beginPath();
        bx.arc(-16, -8, 36, 0, 6.28);
        bx.fill();

        bx.globalCompositeOperation = 'source-over';
        bx.restore();
      }

      // 3) Deep Floating Clouds (always present, opacity driven by weather)
      CLOUDS.forEach(c => {
        c.x += c.vx;
        if (c.x > W + c.size * 2) c.x = -c.size * 3;

        bx.save();
        bx.translate(c.x, c.y);
        const ca = c.a * cloudAlphaMultiplier;
        bx.fillStyle = lightMode ? `rgba(220, 235, 255, ${ca})` : `rgba(180, 220, 255, ${ca * 0.8})`;
        bx.shadowColor = lightMode ? "rgba(255,255,255,0.8)" : "rgba(20,30,60,0.5)";
        bx.shadowBlur = 40;
        bx.beginPath();
        bx.arc(0, 0, c.size, 0, 6.28);
        bx.arc(c.size * 0.8, -c.size * 0.4, c.size * 0.9, 0, 6.28);
        bx.arc(c.size * 1.6, 0, c.size * 0.85, 0, 6.28);
        bx.arc(c.size * 0.8, c.size * 0.3, c.size * 0.7, 0, 6.28);
        bx.fill();
        bx.restore();
      });

      // 4) Dynamic Parallax Rain
      if (isRainy) {
        bx.save();
        // Optional storm tilt
        if (isStormy) {
          RAIN_DROPS.forEach(r => r.vx += 0.05); // heavy wind
        }

        bx.lineCap = 'round';
        RAIN_DROPS.forEach(r => {
          r.x += r.vx;
          r.y += r.vy;
          if (r.y > H + r.len) {
            r.y = -50;
            r.x = Math.random() * W;
            if (isStormy && r.x > W) r.x = -50; // wrap wind
          }
          if (r.x > W + 50) r.x = -50;
          if (r.x < -50) r.x = W + 50;

          // Dynamic color based on depth
          bx.strokeStyle = lightMode
            ? `rgba(0, 80, 200, ${r.a})`
            : `rgba(0, 229, 255, ${r.a})`;
          bx.lineWidth = r.z * 1.2;

          bx.beginPath();
          bx.moveTo(r.x, r.y);
          bx.lineTo(r.x + (r.vx * (r.len / r.vy)), r.y + r.len);
          bx.stroke();
        });
        bx.restore();
      }
    }

    (function draw() {
      bx.clearRect(0, 0, W, H);
      const light = document.documentElement.getAttribute("data-theme") === "light";

      // Base backgrounds
      if (!light) hexGrid();

      // Weather Animations layer — fetch weather if script.js hasn't done it already
      const weatherCond = window.cityWeatherContext?.condition;
      drawWeather(weatherCond, light);

      // Particle elements (dots, symbols)
      DOTS.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        bx.beginPath(); bx.arc(p.x, p.y, p.r, 0, 6.28);
        bx.fillStyle = light ? `rgba(0,80,180,${p.a * .2})` : `rgba(0,229,255,${p.a * .25})`; bx.fill();
      });
      for (let i = 0; i < DOTS.length; i++) for (let j = i + 1; j < DOTS.length; j++) {
        const dx = DOTS[i].x - DOTS[j].x, dy = DOTS[i].y - DOTS[j].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 125) {
          bx.beginPath(); bx.moveTo(DOTS[i].x, DOTS[i].y); bx.lineTo(DOTS[j].x, DOTS[j].y);
          bx.strokeStyle = light ? `rgba(0,80,180,${.05 * (1 - d / 125)})` : `rgba(0,229,255,${.05 * (1 - d / 125)})`;
          bx.lineWidth = .5; bx.stroke();
        }
      }
      if (!light) SYMS.forEach(s => {
        s.x += s.vx; s.y += s.vy; s.life++;
        const t = s.life / s.maxLife;
        const fa = (t < .15 ? t / .15 : t > .85 ? (1 - t) / .15 : 1) * .2;
        if (s.t === "drop") drawDrop(s.x, s.y, s.sz, fa, s.hue);
        if (s.t === "therm") drawTherm(s.x, s.y, s.sz, fa);
        if (s.t === "ring") drawRing(s.x, s.y, s.sz, fa, s.hue);
        if (s.t === "hex") drawHex(s.x, s.y, s.sz, fa);
        if (s.t === "dot") drawDot(s.x, s.y, s.sz, fa, s.hue);
        if (s.life >= s.maxLife || s.y < -120 || s.x < -120 || s.x > W + 120) Object.assign(s, newSym());
      });
      requestAnimationFrame(draw);
    })();
  })();

  /* ================================================================
     HEALTH SETTINGS MODAL BINDINGS
  ================================================================ */
  document.addEventListener("DOMContentLoaded", () => {
    const sBtn = document.getElementById("saveHealthSettingsBtn");
    const iT = document.getElementById("idealTempInput");
    const iH = document.getElementById("idealHumInput");
    const iA = document.getElementById("maxAqiInput");

    // Load initial values to modal inputs
    if (iT) iT.value = localStorage.getItem("ideal_temp") || 22;
    if (iH) iH.value = localStorage.getItem("ideal_hum") || 50;
    if (iA) iA.value = localStorage.getItem("max_aqi") || 500;

    // Handle Save
    if (sBtn) {
      sBtn.addEventListener("click", () => {
        localStorage.setItem("ideal_temp", iT.value);
        localStorage.setItem("ideal_hum", iH.value);
        localStorage.setItem("max_aqi", iA.value);

        // Force immediate recalculation if data exists
        const D = window.ENVDATA;
        if (D && D.ready && D.temps.length) {
          const t = D.temps[D.temps.length - 1];
          const h = D.hums[D.hums.length - 1];
          const a = D.aqis[D.aqis.length - 1];
          updateHealth(t, h, a);
        }

        window.closeModal?.("healthSettingsModal");
      });
    }

    // Modal open binding (global delegate)
    document.addEventListener("click", (e) => {
      const g = e.target.closest("[data-modal]");
      if (g && g.dataset.modal === "healthSettingsModal") {
        if (iT) iT.value = localStorage.getItem("ideal_temp") || 22;
        if (iH) iH.value = localStorage.getItem("ideal_hum") || 50;
        if (iA) iA.value = localStorage.getItem("max_aqi") || 500;
        if (typeof window.openModal === "function") {
          window.openModal("healthSettingsModal");
        }
      }
    });
  });

})();