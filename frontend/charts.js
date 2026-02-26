/* ================================================================
   charts.js  — ENVCORE complete UI layer
   Loads AFTER script.js.

   script.js owns canvases: tempHumChart (2 datasets), airChart,
                             tempGauge, airGauge
   charts.js owns canvases: humLineChart, humGauge, healthRing,
                             tempLargeCanvas, humLargeCanvas,
                             airLargeCanvas, sparklines, bgCanvas
================================================================ */
(function () {
  "use strict";

  /* ─────────────────────────────────────────────────────────────
     CONSTANTS
  ───────────────────────────────────────────────────────────── */
  const TICK   = "rgba(200,232,255,0.72)";
  const GRID   = "rgba(255,255,255,0.07)";
  const FONT   = "Rajdhani";

  // Y-axis full ranges per sensor
  const RANGE = {
    temp: { min: -10, max: 60,   step: 5   },
    hum:  { min: 0,   max: 100,  step: 5   },
    aqi:  { min: 0,   max: 3000, step: 200 },
  };

  /* ─────────────────────────────────────────────────────────────
     CHART FACTORY
  ───────────────────────────────────────────────────────────── */
  function makeLineChart(canvasId, label, color, range) {
    const el = document.getElementById(canvasId);
    if (!el) return null;
    const rgba = color.replace("rgb(","rgba(").replace(")",",0.13)");
    return new Chart(el.getContext("2d"), {
      type: "line",
      data: { labels: [], datasets: [{
        label, borderColor: color, backgroundColor: rgba,
        data: [], tension: 0.4, pointRadius: 3, pointHoverRadius: 7,
        pointBackgroundColor: color, fill: true, borderWidth: 2,
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 600 },
        plugins: {
          legend: { labels: { color: TICK, font: { family: FONT, size: 13 }, boxWidth: 26, padding: 14 }},
          tooltip: {
            mode: "index", intersect: false,
            backgroundColor: "rgba(6,16,30,0.93)", borderColor: color, borderWidth: 1,
            titleColor: TICK, bodyColor: "#fff",
            titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12,
          },
        },
        scales: {
          x: {
            ticks: { color: TICK, maxTicksLimit: 16, maxRotation: 45, font: { family: FONT, size: 11 }},
            grid: { color: GRID },
          },
          y: {
            min: range.min, max: range.max,
            ticks: { color: TICK, stepSize: range.step, maxTicksLimit: 20, font: { family: FONT, size: 11 }},
            grid: { color: GRID },
          },
        },
      },
    });
  }

  function makeSparkline(canvasId, color) {
    const el = document.getElementById(canvasId);
    if (!el) return null;
    const rgba = color.replace("rgb(","rgba(").replace(")",",0.12)");
    return new Chart(el.getContext("2d"), {
      type: "line",
      data: { labels: [], datasets: [{ data: [], borderColor: color, backgroundColor: rgba,
        borderWidth: 1.5, pointRadius: 0, fill: true, tension: 0.4 }]},
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }},
        scales: { x: { display: false }, y: { display: false }},
      },
    });
  }

  /* ─────────────────────────────────────────────────────────────
     CHART INSTANCES  (charts.js owns these)
  ───────────────────────────────────────────────────────────── */
  const humLineChart   = makeLineChart("humLineChart",   "Humidity (%)",     "rgb(0,229,255)",  RANGE.hum);
  const tempLargeChart = makeLineChart("tempLargeCanvas","Temperature (°C)", "rgb(255,77,77)",  RANGE.temp);
  const humLargeChart  = makeLineChart("humLargeCanvas", "Humidity (%)",     "rgb(0,229,255)",  RANGE.hum);
  const airLargeChart  = makeLineChart("airLargeCanvas", "Air Quality",      "rgb(0,255,136)",  RANGE.aqi);

  const tempSpk = makeSparkline("tempSparkline", "rgb(255,77,77)");
  const humSpk  = makeSparkline("humSparkline",  "rgb(0,229,255)");
  const airSpk  = makeSparkline("airSparkline",  "rgb(0,255,136)");

  /* Humidity gauge */
  let humGauge = null;
  const humGaugeEl = document.getElementById("humGauge");
  if (humGaugeEl) {
    humGauge = new Chart(humGaugeEl.getContext("2d"), {
      type: "doughnut",
      data: { datasets: [{ data: [0, 100], backgroundColor: ["#00e5ff","#1e293b"], borderWidth: 0 }]},
      options: { rotation:-90, circumference:180, cutout:"75%",
        animation:false, plugins:{ legend:{ display:false }}},
    });
  }

  /* Health ring */
  let healthChart = null;
  const healthEl = document.getElementById("healthRing");
  if (healthEl) {
    healthChart = new Chart(healthEl.getContext("2d"), {
      type: "doughnut",
      data: { datasets: [{ data: [33,33,34],
        backgroundColor: ["rgba(255,77,77,0.15)","rgba(0,229,255,0.15)","rgba(0,255,136,0.15)"],
        borderColor:     ["rgba(255,77,77,0.7)", "rgba(0,229,255,0.7)", "rgba(0,255,136,0.7)"],
        borderWidth: 2 }]},
      options: { cutout:"75%", plugins:{ legend:{display:false}, tooltip:{enabled:false}},
        animation:{ duration:900 }},
    });
  }

  /* ─────────────────────────────────────────────────────────────
     PATCH SCRIPT.JS CHARTS for dense axes
     Run once after script.js initialises them
  ───────────────────────────────────────────────────────────── */
  function patchAxes() {
    const all = Object.values(Chart.instances);

    const mainChart = all.find(c => c.canvas?.id === "tempHumChart");
    if (mainChart) {
      const sc = mainChart.options.scales;
      sc.y.min = RANGE.temp.min; sc.y.max = RANGE.temp.max;
      sc.y.ticks = { color:TICK, stepSize:RANGE.temp.step, maxTicksLimit:20, font:{family:FONT,size:11} };
      sc.y.grid  = { color:GRID };
      sc.x.ticks = { color:TICK, maxTicksLimit:16, maxRotation:45, font:{family:FONT,size:11} };
      sc.x.grid  = { color:GRID };
      mainChart.options.plugins.tooltip = {
        mode:"index", intersect:false, backgroundColor:"rgba(6,16,30,0.93)",
        borderColor:"rgb(255,77,77)", borderWidth:1,
        titleColor:TICK, bodyColor:"#fff",
        titleFont:{family:FONT,size:12}, bodyFont:{family:FONT,size:13}, padding:12,
      };
      mainChart.update("none");
    }

    const aqiChart = all.find(c => c.canvas?.id === "airChart");
    if (aqiChart) {
      const sc = aqiChart.options.scales;
      sc.y.min = RANGE.aqi.min; sc.y.max = RANGE.aqi.max;
      sc.y.ticks = { color:TICK, stepSize:RANGE.aqi.step, maxTicksLimit:20, font:{family:FONT,size:11} };
      sc.y.grid  = { color:GRID };
      sc.x.ticks = { color:TICK, maxTicksLimit:16, maxRotation:45, font:{family:FONT,size:11} };
      sc.x.grid  = { color:GRID };
      aqiChart.options.plugins.tooltip = {
        mode:"index", intersect:false, backgroundColor:"rgba(6,16,30,0.93)",
        borderColor:"rgb(0,255,136)", borderWidth:1,
        titleColor:TICK, bodyColor:"#fff",
        titleFont:{family:FONT,size:12}, bodyFont:{family:FONT,size:13}, padding:12,
      };
      aqiChart.update("none");
    }
  }
  setTimeout(patchAxes, 600);

  /* ─────────────────────────────────────────────────────────────
     HUMIDITY FIX — intercept tempHumChart every cycle
     script.js puts both datasets into tempHumChart and calls
     tempHumChart.update() at 3000ms. We run at 3050ms to catch
     the fresh data, save humidity array, then strip dataset[1].
  ───────────────────────────────────────────────────────────── */
  // Cache last known hum array so we always have data even after strip
  let _lastHumData   = [];
  let _lastHumLabels = [];

  function syncHumidity() {
    const all = Object.values(Chart.instances);
    const mainChart = all.find(c => c.canvas?.id === "tempHumChart");
    if (!mainChart) return;

    const labels = mainChart.data.labels || [];
    if (!labels.length) return;

    // dataset[1] is humidity — grab it BEFORE stripping
    if (mainChart.data.datasets.length >= 2) {
      const humDs = mainChart.data.datasets[1];
      if (humDs && humDs.data.length) {
        _lastHumData   = humDs.data.slice();
        _lastHumLabels = labels.slice();
      }
      // Strip humidity from temperature tile
      mainChart.data.datasets = [mainChart.data.datasets[0]];
      // Re-apply temp axis range every cycle (script.js update() can reset it)
      const sc = mainChart.options.scales;
      sc.y.min = RANGE.temp.min; sc.y.max = RANGE.temp.max;
      if (!sc.y.ticks) sc.y.ticks = {};
      sc.y.ticks.stepSize = RANGE.temp.step;
      sc.y.ticks.maxTicksLimit = 20;
      sc.y.ticks.color = TICK;
      sc.y.grid = { color: GRID };
      mainChart.update("none");
    }

    // Push saved hum data into humidity tile chart
    if (humLineChart && _lastHumData.length) {
      humLineChart.data.labels = _lastHumLabels;
      humLineChart.data.datasets[0].data = _lastHumData;
      humLineChart.update("none");
    }

    // Update humidity gauge
    const lastHum = _lastHumData[_lastHumData.length - 1];
    if (humGauge && lastHum != null && !isNaN(lastHum)) {
      humGauge.data.datasets[0].data = [lastHum, Math.max(0, 100 - lastHum)];
      humGauge.update("none");
      const el = document.getElementById("humGaugeValue");
      if (el) el.textContent = lastHum.toFixed(1) + " %";
    }

    // Mirror to modal large charts
    const tempDs = mainChart.data.datasets[0];
    if (tempLargeChart && tempDs) {
      tempLargeChart.data.labels = labels;
      tempLargeChart.data.datasets[0].data = tempDs.data.slice();
      tempLargeChart.update("none");
    }
    if (humLargeChart && _lastHumData.length) {
      humLargeChart.data.labels = _lastHumLabels;
      humLargeChart.data.datasets[0].data = _lastHumData;
      humLargeChart.update("none");
    }

    // Mirror AQI
    const aqiChart = all.find(c => c.canvas?.id === "airChart");
    if (airLargeChart && aqiChart?.data.labels.length) {
      airLargeChart.data.labels = aqiChart.data.labels;
      airLargeChart.data.datasets[0].data = aqiChart.data.datasets[0]?.data || [];
      airLargeChart.update("none");
    }
  }

  // Run at 3050ms intervals — just after script.js 3000ms fetchHistory
  // Also run once early to catch any pre-existing data
  setTimeout(syncHumidity, 400);
  setTimeout(syncHumidity, 3050);
  setInterval(syncHumidity, 3050);

  /* ─────────────────────────────────────────────────────────────
     ANIMATED BACKGROUND
     Three simultaneous layers on #bgCanvas:
       1. Hex grid — subtle breathing hex cells
       2. Particle network — moving dots with connection lines
       3. Floating symbols — water drops, thermometers, AQI rings
  ───────────────────────────────────────────────────────────── */
  (function initBackground() {
    const cv = document.getElementById("bgCanvas");
    if (!cv) return;
    const bx = cv.getContext("2d");
    let W, H;

    function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
    resize();
    window.addEventListener("resize", resize);

    /* === LAYER 1: Hex grid === */
    let hexT = 0;
    function drawHexGrid() {
      hexT += 0.004;
      const S = 62; // hex cell size
      const cols = Math.ceil(W / (S * 1.5)) + 2;
      const rows = Math.ceil(H / (S * Math.sqrt(3))) + 2;
      bx.save();
      bx.globalAlpha = 0.016 + Math.sin(hexT) * 0.007;
      bx.strokeStyle = "#00e5ff";
      bx.lineWidth   = 0.55;
      for (let c = -1; c < cols; c++) {
        for (let r = -1; r < rows; r++) {
          const cx = c * S * 1.5;
          const cy = r * S * Math.sqrt(3) + (c % 2 === 0 ? 0 : S * Math.sqrt(3) / 2);
          bx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
            const px = cx + Math.cos(a) * S * 0.47;
            const py = cy + Math.sin(a) * S * 0.47;
            i === 0 ? bx.moveTo(px, py) : bx.lineTo(px, py);
          }
          bx.closePath(); bx.stroke();
        }
      }
      bx.restore();
    }

    /* === LAYER 2: Particle network === */
    const DOTS = Array.from({ length: 65 }, () => ({
      x:  Math.random() * 1920, y: Math.random() * 1080,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      r:  Math.random() * 1.5 + 0.4,
      a:  Math.random() * 0.4 + 0.15,
    }));

    function drawNetwork(light) {
      DOTS.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        bx.beginPath(); bx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        bx.fillStyle = light ? `rgba(0,80,180,${p.a*0.18})` : `rgba(0,229,255,${p.a*0.26})`;
        bx.fill();
      });
      for (let i = 0; i < DOTS.length; i++) {
        for (let j = i+1; j < DOTS.length; j++) {
          const dx = DOTS[i].x - DOTS[j].x, dy = DOTS[i].y - DOTS[j].y;
          const d  = Math.sqrt(dx*dx + dy*dy);
          if (d < 125) {
            bx.beginPath();
            bx.moveTo(DOTS[i].x, DOTS[i].y); bx.lineTo(DOTS[j].x, DOTS[j].y);
            bx.strokeStyle = light
              ? `rgba(0,80,180,${0.05*(1-d/125)})`
              : `rgba(0,229,255,${0.05*(1-d/125)})`;
            bx.lineWidth = 0.5; bx.stroke();
          }
        }
      }
    }

    /* === LAYER 3: Floating environmental symbols === */
    // Types: "drop"=water, "therm"=thermometer, "ring"=AQI molecule,
    //        "hex"=hexagon chip, "cross"=data cross, "dot"=glow dot
    function newSymbol() {
      const types = ["drop","drop","drop","therm","therm","ring","ring","hex","dot","cross"];
      const hues  = [185, 195, 160, 140, 175];
      return {
        type:    types[Math.floor(Math.random() * types.length)],
        x:       Math.random() * 1920,
        y:       H + 30 + Math.random() * 200,
        vx:      (Math.random() - 0.5) * 0.14,
        vy:      -(Math.random() * 0.4 + 0.12),
        size:    Math.random() * 15 + 7,
        life:    0,
        maxLife: Math.random() * 700 + 350,
        hue:     hues[Math.floor(Math.random() * hues.length)],
        rot:     Math.random() * Math.PI * 2,
        rotV:    (Math.random() - 0.5) * 0.007,
      };
    }

    const SYMS = Array.from({ length: 40 }, newSymbol);
    // spread initial y across screen
    SYMS.forEach(s => { s.y = Math.random() * H; s.life = Math.random() * s.maxLife; });

    function alpha(s) {
      const t = s.life / s.maxLife;
      const fade = t < 0.12 ? t/0.12 : t > 0.85 ? (1-t)/0.15 : 1;
      return Math.min(fade * 0.24, 0.24); // cap at 0.24 — always subtle
    }

    function drawDrop(s, a) {
      bx.save(); bx.translate(s.x, s.y);
      bx.globalAlpha = a;
      bx.strokeStyle = `hsl(${s.hue},88%,65%)`;
      bx.shadowColor = `hsl(${s.hue},88%,65%)`; bx.shadowBlur = 8;
      bx.lineWidth   = 1.1;
      const z = s.size;
      bx.beginPath();
      bx.moveTo(0, -z);
      bx.bezierCurveTo( z*0.85, -z*0.15,  z*0.85,  z*0.55, 0,  z*0.82);
      bx.bezierCurveTo(-z*0.85,  z*0.55, -z*0.85, -z*0.15, 0, -z);
      bx.stroke();
      // inner shimmer
      bx.globalAlpha = a * 0.25;
      bx.fillStyle = `hsl(${s.hue},88%,75%)`;
      bx.beginPath();
      bx.ellipse(-z*0.22, -z*0.1, z*0.14, z*0.28, -0.4, 0, Math.PI*2);
      bx.fill();
      bx.restore();
    }

    function drawTherm(s, a) {
      bx.save(); bx.translate(s.x, s.y);
      bx.globalAlpha = a;
      bx.strokeStyle = `rgba(255,100,80,${a})`;
      bx.shadowColor = "#ff4d4d"; bx.shadowBlur = 7;
      bx.lineWidth   = 1.3;
      const z = s.size;
      // tube
      bx.beginPath();
      const left=-z*0.2, right=z*0.2, top=-z, bottom=z*0.55;
      bx.moveTo(left, top+z*0.2); bx.arcTo(left, top, right, top, z*0.2);
      bx.arcTo(right, top, right, bottom, z*0.2); bx.lineTo(right, bottom);
      bx.lineTo(left, bottom); bx.lineTo(left, top+z*0.2);
      bx.stroke();
      // bulb
      bx.beginPath(); bx.arc(0, z*0.7, z*0.33, 0, Math.PI*2);
      bx.fillStyle = `rgba(255,77,77,${a*0.55})`; bx.fill(); bx.stroke();
      // mercury fill
      bx.globalAlpha = a * 0.6;
      bx.fillStyle = "#ff6655";
      bx.fillRect(left+1.5, 0, (right-left)-3, bottom);
      bx.restore();
    }

    function drawRing(s, a) {
      bx.save(); bx.translate(s.x, s.y); bx.rotate(s.rot);
      bx.globalAlpha = a;
      bx.strokeStyle = `hsl(${s.hue},88%,62%)`;
      bx.shadowColor = `hsl(${s.hue},88%,62%)`; bx.shadowBlur = 10;
      bx.lineWidth = 0.9;
      const z = s.size;
      // outer ring
      bx.beginPath(); bx.arc(0, 0, z, 0, Math.PI*2); bx.stroke();
      // inner ring
      bx.globalAlpha = a * 0.45;
      bx.beginPath(); bx.arc(0, 0, z*0.52, 0, Math.PI*2); bx.stroke();
      // 6 orbital dots
      for (let i = 0; i < 6; i++) {
        const ang = (i/6)*Math.PI*2;
        bx.globalAlpha = a * 0.8;
        bx.beginPath(); bx.arc(Math.cos(ang)*z, Math.sin(ang)*z, z*0.11, 0, Math.PI*2);
        bx.fillStyle = `hsl(${s.hue},88%,72%)`; bx.fill();
      }
      bx.restore();
    }

    function drawHexSym(s, a) {
      bx.save(); bx.translate(s.x, s.y); bx.rotate(s.rot);
      bx.globalAlpha = a * 0.38;
      bx.strokeStyle = "#00e5ff"; bx.lineWidth = 0.65;
      bx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i/6)*Math.PI*2 - Math.PI/6;
        const px = Math.cos(ang)*s.size, py = Math.sin(ang)*s.size;
        i===0 ? bx.moveTo(px,py) : bx.lineTo(px,py);
      }
      bx.closePath(); bx.stroke();
      bx.restore();
    }

    function drawCross(s, a) {
      bx.save(); bx.translate(s.x, s.y); bx.rotate(s.rot + Math.PI/4);
      bx.globalAlpha = a * 0.35;
      bx.strokeStyle = `hsl(${s.hue},70%,65%)`; bx.lineWidth = 0.7;
      const z = s.size * 0.6;
      bx.beginPath(); bx.moveTo(-z,0); bx.lineTo(z,0); bx.stroke();
      bx.beginPath(); bx.moveTo(0,-z); bx.lineTo(0,z); bx.stroke();
      bx.restore();
    }

    function drawDotSym(s, a) {
      bx.save();
      bx.globalAlpha = a;
      bx.beginPath(); bx.arc(s.x, s.y, s.size*0.22, 0, Math.PI*2);
      bx.fillStyle = `hsl(${s.hue},88%,68%)`;
      bx.shadowColor = `hsl(${s.hue},88%,68%)`; bx.shadowBlur = s.size * 1.4;
      bx.fill(); bx.restore();
    }

    function drawSymbols() {
      SYMS.forEach(s => {
        s.x += s.vx; s.y += s.vy; s.rot += s.rotV; s.life++;
        const a = alpha(s);
        switch (s.type) {
          case "drop":  drawDrop(s, a);    break;
          case "therm": drawTherm(s, a);   break;
          case "ring":  drawRing(s, a);    break;
          case "hex":   drawHexSym(s, a);  break;
          case "cross": drawCross(s, a);   break;
          default:      drawDotSym(s, a);
        }
        if (s.life >= s.maxLife || s.y < -80 || s.x < -100 || s.x > W+100) {
          Object.assign(s, newSymbol());
        }
      });
    }

    /* Main draw loop */
    (function draw() {
      bx.clearRect(0, 0, W, H);
      const light = document.documentElement.getAttribute("data-theme") === "light";
      if (!light) drawHexGrid();
      drawNetwork(light);
      if (!light) drawSymbols();
      requestAnimationFrame(draw);
    })();
  })();

  /* ─────────────────────────────────────────────────────────────
     CLOCK
  ───────────────────────────────────────────────────────────── */
  (function tick() {
    const el = document.getElementById("clockDisplay");
    if (el) el.textContent = new Date().toLocaleTimeString("en-GB");
    setTimeout(tick, 1000);
  })();

  /* ─────────────────────────────────────────────────────────────
     LOCATION  — Geolocation API + reverse geocode
  ───────────────────────────────────────────────────────────── */
  function initLocation() {
    const locEl   = document.getElementById("locationDisplay");
    const locIcon = document.getElementById("locationIcon");
    if (!locEl) return;

    if (!navigator.geolocation) {
      locEl.textContent = "Location N/A";
      return;
    }

    locEl.textContent = "Locating...";
    if (locIcon) locIcon.classList.add("pinging");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          // Open-Meteo geocoding (no API key required)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
          );
          const data = await res.json();
          const city = data.address?.city
                    || data.address?.town
                    || data.address?.village
                    || data.address?.county
                    || "Unknown";
          const country = data.address?.country_code?.toUpperCase() || "";
          locEl.textContent  = `${city}${country ? ", " + country : ""}`;
          if (locIcon) locIcon.classList.remove("pinging");
          if (locIcon) locIcon.classList.add("located");
        } catch {
          locEl.textContent = `${lat.toFixed(2)}°N ${lon.toFixed(2)}°E`;
        }
      },
      () => {
        locEl.textContent = "Access denied";
        if (locIcon) locIcon.classList.remove("pinging");
      },
      { timeout: 10000 }
    );
  }
  initLocation();

  /* ─────────────────────────────────────────────────────────────
     THEME TOGGLE
  ───────────────────────────────────────────────────────────── */
  document.getElementById("themeToggle")?.addEventListener("click", function () {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
    this.classList.toggle("light-mode", dark);
  });

  /* ─────────────────────────────────────────────────────────────
     MODAL OPEN / CLOSE
     Override script.js openModal/closeModal
  ───────────────────────────────────────────────────────────── */
  window.openModal = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = "flex";
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

  /* ─────────────────────────────────────────────────────────────
     ALERT BANNER
  ───────────────────────────────────────────────────────────── */
  let lastAlertTs = 0;
  function checkAlerts(temp, hum, aqi) {
    if (Date.now() - lastAlertTs < 12000) return;
    const msgs = [];
    if (temp > 35)   msgs.push(`🌡 Temperature critical: ${temp}°C`);
    if (temp < 5)    msgs.push(`🌡 Temperature very low: ${temp}°C`);
    if (hum  > 85)   msgs.push(`💧 Humidity high: ${hum}%`);
    if (hum  < 20)   msgs.push(`💧 Humidity very low: ${hum}%`);
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

  /* ─────────────────────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────────────────────── */
  function setEl(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

  function statsOf(arr) {
    if (!arr.length) return { min:"--", max:"--", avg:"--" };
    return {
      min: Math.min(...arr).toFixed(1),
      max: Math.max(...arr).toFixed(1),
      avg: (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1),
    };
  }

  /* ─────────────────────────────────────────────────────────────
     HEALTH SCORE RING
  ───────────────────────────────────────────────────────────── */
  function updateHealth(temp, hum, aqi) {
    const ts = Math.max(0, 100 - Math.abs(temp-22)*4);
    const hs = Math.max(0, 100 - Math.abs(hum-50)*2);
    const as = Math.max(0, 100 - (aqi/3000)*100);
    const overall = Math.round((ts+hs+as)/3);
    setEl("healthScore", overall);

    let grade="--", col="#00e5ff";
    if (overall>=80)     { grade="EXCELLENT"; col="#00ff88"; }
    else if (overall>=60){ grade="GOOD";      col="#00e5ff"; }
    else if (overall>=40){ grade="MODERATE";  col="#ffcc00"; }
    else                 { grade="POOR";      col="#ff4d4d"; }

    const g = document.getElementById("healthGrade");
    if (g) { g.textContent=grade; g.style.color=col; }

    if (healthChart) {
      healthChart.data.datasets[0].data = [ts, hs, as];
      healthChart.data.datasets[0].borderColor = [
        `rgba(255,77,77,${0.4+ts/200})`,
        `rgba(0,229,255,${0.4+hs/200})`,
        `rgba(0,255,136,${0.4+as/200})`,
      ];
      healthChart.data.datasets[0].backgroundColor = [
        `rgba(255,77,77,${0.06+ts/400})`,
        `rgba(0,229,255,${0.06+hs/400})`,
        `rgba(0,255,136,${0.06+as/400})`,
      ];
      healthChart.update("none");
    }
    setEl("hlTemp", Math.round(ts));
    setEl("hlHum",  Math.round(hs));
    setEl("hlAqi",  Math.round(as));
  }

  /* ─────────────────────────────────────────────────────────────
     CARD ANIMATED BACKGROUNDS + PROGRESS BARS
  ───────────────────────────────────────────────────────────── */
  function updateCardBg(temp, hum, aqi) {
    const th = Math.round(220 - Math.min(Math.max(temp,0),50)/50*220);
    const tb = document.querySelector(".temp-bg");
    if (tb) tb.style.background =
      `radial-gradient(circle at 30% 50%,hsla(${th},100%,55%,0.18),transparent 70%)`;

    const hh = Math.round(30 + Math.min(Math.max(hum,0),100)/100*170);
    const hb = document.querySelector(".hum-bg");
    if (hb) hb.style.background =
      `radial-gradient(circle at 70% 40%,hsla(${hh},100%,55%,0.18),transparent 70%)`;

    const tempBar = document.getElementById("tempBar");
    const humBar  = document.getElementById("humBar");
    const airBar  = document.getElementById("airBar");
    if (tempBar) tempBar.style.width = `${Math.min(Math.max((temp+10)/70*100,0),100)}%`;
    if (humBar)  humBar.style.width  = `${Math.min(Math.max(hum,0),100)}%`;
    if (airBar)  airBar.style.width  = `${Math.min(aqi/3000*100,100)}%`;
  }

  /* ─────────────────────────────────────────────────────────────
     LOCAL HISTORY  — sparklines + card stats
     MutationObserver watches the DOM values script.js updates
  ───────────────────────────────────────────────────────────── */
  const LOCAL = { temp:[], hum:[], aqi:[], labels:[] };
  let lastKnown = { temp:null, hum:null, aqi:null };

  function onValueChange() {
    const temp = parseFloat(document.getElementById("temp")?.textContent);
    const hum  = parseFloat(document.getElementById("hum")?.textContent);
    const aqi  = parseFloat(document.getElementById("air")?.textContent);
    if (isNaN(temp)||isNaN(hum)||isNaN(aqi)) return;
    if (temp===lastKnown.temp && hum===lastKnown.hum && aqi===lastKnown.aqi) return;
    lastKnown = { temp, hum, aqi };

    updateHealth(temp, hum, aqi);
    updateCardBg(temp, hum, aqi);
    checkAlerts(temp, hum, aqi);

    if (LOCAL.labels.length >= 40) {
      LOCAL.temp.shift(); LOCAL.hum.shift(); LOCAL.aqi.shift(); LOCAL.labels.shift();
    }
    LOCAL.temp.push(temp); LOCAL.hum.push(hum); LOCAL.aqi.push(aqi);
    LOCAL.labels.push(new Date().toLocaleTimeString("en-GB"));

    [[tempSpk,LOCAL.temp],[humSpk,LOCAL.hum],[airSpk,LOCAL.aqi]].forEach(([s,d])=>{
      if(!s)return;
      s.data.labels=LOCAL.labels; s.data.datasets[0].data=d; s.update("none");
    });

    const ts=statsOf(LOCAL.temp), hs=statsOf(LOCAL.hum), as=statsOf(LOCAL.aqi);
    ["Min","Avg","Max"].forEach((k,i)=>{
      setEl("temp"+k, [ts.min,ts.avg,ts.max][i]);
      setEl("hum" +k, [hs.min,hs.avg,hs.max][i]);
      setEl("air" +k, [as.min,as.avg,as.max][i]);
      setEl("tTemp"+k, [ts.min,ts.avg,ts.max][i]);
      setEl("tHum" +k, [hs.min,hs.avg,hs.max][i]);
      setEl("tAqi" +k, [as.min,as.avg,as.max][i]);
    });
  }

  ["temp","hum","air"].forEach(id=>{
    const el=document.getElementById(id);
    if(el) new MutationObserver(onValueChange)
      .observe(el,{childList:true,characterData:true,subtree:true});
  });

})();