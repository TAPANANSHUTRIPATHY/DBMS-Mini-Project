/* ================================================================
   charts.js  — UI layer for ENVCORE dashboard
   Runs AFTER script.js. Does NOT modify script.js variables.
   
   script.js owns:
     tempHumChart  → canvas#tempHumChart  (temp + hum datasets)
     airChart      → canvas#airChart      (aqi dataset)
     tempGauge     → canvas#tempGauge
     airGauge      → canvas#airGauge
     fetchLatest(), fetchHistory(), openModal(), closeModal()
   
   charts.js owns:
     humLineChart  → canvas#humLineChart  (hum only tile)
     humGauge      → canvas#humGauge
     healthRing    → canvas#healthRing
     tempLargeChart→ canvas#tempLargeCanvas  (modal)
     humLargeChart → canvas#humLargeCanvas   (modal)
     airLargeChart → canvas#airLargeCanvas   (modal)
     sparklines    → tempSparkline, humSparkline, airSparkline
     theme, clock, particles, alerts
================================================================ */

(function () {
  "use strict";

  /* ── Shared chart style constants ── */
  const C = {
    TICK : "rgba(200,232,255,0.65)",
    GRID : "rgba(255,255,255,0.05)",
    RED  : "rgb(255,77,77)",
    CYAN : "rgb(0,229,255)",
    GREEN: "rgb(0,255,136)",
  };

  /* ── Build a standard line chart config ── */
  function lineConfig(label, color) {
    const rgba = color.replace("rgb(", "rgba(").replace(")", ",0.13)");
    return {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label,
          borderColor: color,
          backgroundColor: rgba,
          data: [],
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 6,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500 },
        plugins: {
          legend: { labels: { color: C.TICK, font: { family: "Rajdhani", size: 12 } } },
          tooltip: { mode: "index", intersect: false },
        },
        scales: {
          x: { ticks: { color: C.TICK, maxTicksLimit: 8, font: { family: "Rajdhani" } }, grid: { color: C.GRID } },
          y: { ticks: { color: C.TICK, font: { family: "Rajdhani" } }, grid: { color: C.GRID } },
        },
      },
    };
  }

  /* ── Build a sparkline config ── */
  function sparkConfig(color) {
    const rgba = color.replace("rgb(", "rgba(").replace(")", ",0.12)");
    return {
      type: "line",
      data: { labels: [], datasets: [{ data: [], borderColor: color, backgroundColor: rgba,
        borderWidth: 1.5, pointRadius: 0, fill: true, tension: 0.4 }] },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } },
      },
    };
  }

  /* ── Get a canvas context safely ── */
  function ctx(id) {
    const el = document.getElementById(id);
    return el ? el.getContext("2d") : null;
  }

  /* ── Initialize all OUR charts ── */

  // Humidity tile
  const humLineChart = ctx("humLineChart")
    ? new Chart(ctx("humLineChart"), lineConfig("Humidity (%)", C.CYAN))
    : null;

  // Modal full-view charts (dedicated canvases, NOT shared with tiles)
  const tempLargeChart = ctx("tempLargeCanvas")
    ? new Chart(ctx("tempLargeCanvas"), lineConfig("Temperature (°C)", C.RED))
    : null;
  const humLargeChart = ctx("humLargeCanvas")
    ? new Chart(ctx("humLargeCanvas"), lineConfig("Humidity (%)", C.CYAN))
    : null;
  const airLargeChart = ctx("airLargeCanvas")
    ? new Chart(ctx("airLargeCanvas"), lineConfig("Air Quality", C.GREEN))
    : null;

  // Humidity gauge
  const humGauge = ctx("humGauge")
    ? new Chart(ctx("humGauge"), {
        type: "doughnut",
        data: { datasets: [{ data: [0, 100], backgroundColor: ["#00e5ff", "#1e293b"], borderWidth: 0 }] },
        options: { rotation: -90, circumference: 180, cutout: "75%",
          animation: false, plugins: { legend: { display: false } } },
      })
    : null;

  // Health ring
  const healthChart = ctx("healthRing")
    ? new Chart(ctx("healthRing"), {
        type: "doughnut",
        data: {
          datasets: [{
            data: [33, 33, 34],
            backgroundColor: ["rgba(255,77,77,0.15)", "rgba(0,229,255,0.15)", "rgba(0,255,136,0.15)"],
            borderColor:     ["rgba(255,77,77,0.7)",  "rgba(0,229,255,0.7)",  "rgba(0,255,136,0.7)"],
            borderWidth: 2,
          }],
        },
        options: {
          cutout: "75%",
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          animation: { duration: 900 },
        },
      })
    : null;

  // Sparklines
  const tempSpk = ctx("tempSparkline") ? new Chart(ctx("tempSparkline"), sparkConfig(C.RED))   : null;
  const humSpk  = ctx("humSparkline")  ? new Chart(ctx("humSparkline"),  sparkConfig(C.CYAN))  : null;
  const airSpk  = ctx("airSparkline")  ? new Chart(ctx("airSparkline"),  sparkConfig(C.GREEN)) : null;

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
     PARTICLE BACKGROUND
  ================================================================ */
  (function particles() {
    const cv  = document.getElementById("bgCanvas");
    if (!cv) return;
    const pctx = cv.getContext("2d");
    let W, H;
    const pts = Array.from({ length: 80 }, () => ({
      x: Math.random() * 1920, y: Math.random() * 1080,
      vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 1.4 + 0.4, a: Math.random() * 0.5 + 0.2,
    }));

    function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
    resize();
    window.addEventListener("resize", resize);

    (function draw() {
      pctx.clearRect(0, 0, W, H);
      const light = document.documentElement.getAttribute("data-theme") === "light";
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        pctx.beginPath();
        pctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        pctx.fillStyle = light ? `rgba(0,80,180,${p.a * 0.2})` : `rgba(0,229,255,${p.a * 0.28})`;
        pctx.fill();
      });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < 130) {
            pctx.beginPath();
            pctx.moveTo(pts[i].x, pts[i].y);
            pctx.lineTo(pts[j].x, pts[j].y);
            pctx.strokeStyle = light
              ? `rgba(0,80,180,${0.06 * (1 - d / 130)})`
              : `rgba(0,229,255,${0.06 * (1 - d / 130)})`;
            pctx.lineWidth = 0.5;
            pctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    })();
  })();

  /* ================================================================
     MODAL OPEN / CLOSE
     Override script.js openModal/closeModal for our new modal IDs
  ================================================================ */
  window.openModal = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = "flex";
    // After display:flex, trigger resize so Chart.js knows its canvas size
    setTimeout(() => {
      if (id === "tempModal" && tempLargeChart) tempLargeChart.resize();
      if (id === "humModal"  && humLargeChart)  humLargeChart.resize();
      if (id === "airModal"  && airLargeChart)  airLargeChart.resize();
    }, 60);
  };

  window.closeModal = function (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  };

  /* ================================================================
     ALERT BANNER
  ================================================================ */
  let lastAlertTs = 0;
  function checkAlerts(temp, hum, aqi) {
    if (Date.now() - lastAlertTs < 12000) return;
    const msgs = [];
    if (temp > 35)   msgs.push(`🌡 Temperature critical: ${temp}°C`);
    if (temp < 10)   msgs.push(`🌡 Temperature low: ${temp}°C`);
    if (hum  > 80)   msgs.push(`💧 Humidity high: ${hum}%`);
    if (aqi  > 2000) msgs.push(`🌫 Air quality POOR: AQI ${aqi}`);
    else if (aqi > 1000) msgs.push(`🌫 Air quality MODERATE: AQI ${aqi}`);
    if (!msgs.length) return;
    const banner = document.getElementById("alertBanner");
    const text   = document.getElementById("alertText");
    if (banner && text) {
      text.textContent = msgs[0];
      banner.classList.remove("hidden");
      lastAlertTs = Date.now();
    }
  }

  /* ================================================================
     HELPERS
  ================================================================ */
  function setEl(id, v) {
    const e = document.getElementById(id);
    if (e) e.textContent = v;
  }

  function statsOf(arr) {
    if (!arr.length) return { min: "--", max: "--", avg: "--" };
    return {
      min: Math.min(...arr).toFixed(1),
      max: Math.max(...arr).toFixed(1),
      avg: (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1),
    };
  }

  function mirrorData(chart, labels, data) {
    if (!chart) return;
    chart.data.labels = labels;
    if (chart.data.datasets.length === 0) return;
    chart.data.datasets[0].data = data;
    chart.update("none");
  }

  /* ================================================================
     HEALTH SCORE RING
  ================================================================ */
  function updateHealth(temp, hum, aqi) {
    const ts = Math.max(0, 100 - Math.abs(temp - 22) * 4);   // ideal ~22°C
    const hs = Math.max(0, 100 - Math.abs(hum  - 50) * 2);   // ideal ~50%
    const as = Math.max(0, 100 - (aqi / 3000) * 100);
    const overall = Math.round((ts + hs + as) / 3);

    setEl("healthScore", overall);

    let grade = "--", col = "#00e5ff";
    if (overall >= 80)     { grade = "EXCELLENT"; col = "#00ff88"; }
    else if (overall >= 60){ grade = "GOOD";      col = "#00e5ff"; }
    else if (overall >= 40){ grade = "MODERATE";  col = "#ffcc00"; }
    else                   { grade = "POOR";      col = "#ff4d4d"; }

    const g = document.getElementById("healthGrade");
    if (g) { g.textContent = grade; g.style.color = col; }

    if (healthChart) {
      healthChart.data.datasets[0].data         = [ts, hs, as];
      healthChart.data.datasets[0].borderColor  = [
        `rgba(255,77,77,${0.4 + ts / 200})`,
        `rgba(0,229,255,${0.4 + hs / 200})`,
        `rgba(0,255,136,${0.4 + as / 200})`,
      ];
      healthChart.data.datasets[0].backgroundColor = [
        `rgba(255,77,77,${0.06 + ts / 400})`,
        `rgba(0,229,255,${0.06 + hs / 400})`,
        `rgba(0,255,136,${0.06 + as / 400})`,
      ];
      healthChart.update("none");
    }

    setEl("hlTemp", Math.round(ts));
    setEl("hlHum",  Math.round(hs));
    setEl("hlAqi",  Math.round(as));
  }

  /* ================================================================
     ANIMATED CARD BACKGROUNDS  + PROGRESS BARS
  ================================================================ */
  function updateCardBg(temp, hum, aqi) {
    const th = Math.round(220 - Math.min(Math.max(temp, 0), 50) / 50 * 220);
    const tempBg = document.querySelector(".temp-bg");
    if (tempBg) tempBg.style.background =
      `radial-gradient(circle at 30% 50%, hsla(${th},100%,55%,0.18), transparent 70%)`;

    const hh = Math.round(30 + Math.min(Math.max(hum, 0), 100) / 100 * 170);
    const humBg = document.querySelector(".hum-bg");
    if (humBg) humBg.style.background =
      `radial-gradient(circle at 70% 40%, hsla(${hh},100%,55%,0.18), transparent 70%)`;

    const tempBar = document.getElementById("tempBar");
    const humBar  = document.getElementById("humBar");
    const airBar  = document.getElementById("airBar");
    if (tempBar) tempBar.style.width = `${Math.min(temp / 50 * 100, 100)}%`;
    if (humBar)  humBar.style.width  = `${Math.min(hum, 100)}%`;
    if (airBar)  airBar.style.width  = `${Math.min(aqi / 3000 * 100, 100)}%`;
  }

  /* ================================================================
     LOCAL HISTORY  (for sparklines + card stats)
     Keeps last 30 data points from MutationObserver pings
  ================================================================ */
  const LOCAL = { temp: [], hum: [], aqi: [], labels: [] };
  const MAX_LOCAL = 30;
  let lastKnown = { temp: null, hum: null, aqi: null };

  function onDomValueChange() {
    const temp = parseFloat(document.getElementById("temp")?.textContent);
    const hum  = parseFloat(document.getElementById("hum")?.textContent);
    const aqi  = parseFloat(document.getElementById("air")?.textContent);
    if (isNaN(temp) || isNaN(hum) || isNaN(aqi)) return;
    if (temp === lastKnown.temp && hum === lastKnown.hum && aqi === lastKnown.aqi) return;
    lastKnown = { temp, hum, aqi };

    // Run all reactive updates
    updateHealth(temp, hum, aqi);
    updateCardBg(temp, hum, aqi);
    checkAlerts(temp, hum, aqi);

    // Push to local history
    if (LOCAL.labels.length >= MAX_LOCAL) {
      LOCAL.temp.shift(); LOCAL.hum.shift(); LOCAL.aqi.shift(); LOCAL.labels.shift();
    }
    LOCAL.temp.push(temp);
    LOCAL.hum.push(hum);
    LOCAL.aqi.push(aqi);
    LOCAL.labels.push(new Date().toLocaleTimeString("en-GB"));

    // Update sparklines
    [[tempSpk, LOCAL.temp], [humSpk, LOCAL.hum], [airSpk, LOCAL.aqi]].forEach(([spk, arr]) => {
      if (!spk) return;
      spk.data.labels          = LOCAL.labels;
      spk.data.datasets[0].data = arr;
      spk.update("none");
    });

    // Card stats badges
    const ts = statsOf(LOCAL.temp), hs = statsOf(LOCAL.hum), as = statsOf(LOCAL.aqi);
    setEl("tempMin", ts.min); setEl("tempAvg", ts.avg); setEl("tempMax", ts.max);
    setEl("humMin",  hs.min); setEl("humAvg",  hs.avg); setEl("humMax",  hs.max);
    setEl("airMin",  as.min); setEl("airAvg",  as.avg); setEl("airMax",  as.max);

    // Tile header stats
    setEl("tTempMin", ts.min); setEl("tTempAvg", ts.avg); setEl("tTempMax", ts.max);
    setEl("tHumMin",  hs.min); setEl("tHumAvg",  hs.avg); setEl("tHumMax",  hs.max);
    setEl("tAqiMin",  as.min); setEl("tAqiAvg",  as.avg); setEl("tAqiMax",  as.max);
  }

  // Observe the DOM elements script.js updates every 3 seconds
  ["temp", "hum", "air"].forEach(id => {
    const el = document.getElementById(id);
    if (el) new MutationObserver(onDomValueChange)
      .observe(el, { childList: true, characterData: true, subtree: true });
  });

  /* ================================================================
     MAIN SYNC LOOP
     Reads from script.js chart instances directly.
     Runs at 3100ms — just after script.js 3000ms fetchHistory.
     
     KEY: We read tempHumChart.data.datasets[0] (temp) and [1] (hum)
     WITHOUT destroying them. We then strip hum from the tile view
     and route it to the humidity tile + modal.
  ================================================================ */
  function syncFromScriptJs() {
    // ── Get script.js chart instances by canvas ID ──
    const all = Object.values(Chart.instances);
    const mainChart = all.find(c => c.canvas?.id === "tempHumChart");
    const aqiChart  = all.find(c => c.canvas?.id === "airChart");

    if (mainChart && mainChart.data.labels.length > 0) {
      const labels   = mainChart.data.labels;
      const ds0      = mainChart.data.datasets[0]; // Temperature
      const ds1      = mainChart.data.datasets[1]; // Humidity

      const tempData = ds0 ? ds0.data.slice() : [];
      const humData  = ds1 ? ds1.data.slice() : [];

      // ── Strip humidity from the Temperature tile ──
      // script.js re-adds both datasets every 3s, so we strip on every cycle
      if (mainChart.data.datasets.length > 1) {
        mainChart.data.datasets = [mainChart.data.datasets[0]];
        mainChart.update("none");
      }

      // ── Push hum data to our humidity tile chart ──
      if (humLineChart) {
        humLineChart.data.labels               = labels;
        humLineChart.data.datasets[0].data     = humData;
        humLineChart.update("none");
      }

      // ── Update humidity gauge ──
      const lastHum = humData[humData.length - 1];
      if (humGauge && lastHum != null && !isNaN(lastHum)) {
        humGauge.data.datasets[0].data = [lastHum, Math.max(0, 100 - lastHum)];
        humGauge.update("none");
        setEl("humGaugeValue", lastHum.toFixed(1) + " %");
      }

      // ── Mirror to modal large charts ──
      mirrorData(tempLargeChart, labels, tempData);
      mirrorData(humLargeChart,  labels, humData);
    }

    // ── Mirror AQI data to AQI modal chart ──
    if (aqiChart && aqiChart.data.labels.length > 0) {
      mirrorData(
        airLargeChart,
        aqiChart.data.labels,
        aqiChart.data.datasets[0]?.data || []
      );
    }
  }

  // Run immediately on load (data may already be there) then every 3.1s
  setTimeout(syncFromScriptJs, 500);
  setInterval(syncFromScriptJs, 3100);

})(); // end IIFE