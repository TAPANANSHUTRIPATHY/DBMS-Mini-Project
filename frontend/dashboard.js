/* ================================================================
   dashboard.js — ENVCORE Historical Data Dashboard
   Handles: date picker, API fetch, charts, table, pagination,
            CSV export with day-named files, theme, clock, bg
================================================================ */

const API          = "http://localhost:5000/api";
const ROWS_PER_PAGE = 25;

/* ── Chart style constants ── */
const FONT  = "Rajdhani";
const TICK  = "rgba(200,232,255,0.72)";
const GRID  = "rgba(255,255,255,0.06)";

/* ── App state ── */
let allData      = [];
let filteredData = [];
let currentPage  = 1;
let selectedDate = todayStr();

/* ── Chart instances ── */
let dbTempChart = null;
let dbHumChart  = null;
let dbAqiChart  = null;

/* ================================================================
   UTILITY FUNCTIONS
================================================================ */

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function fmtDate(isoStr) {
  return new Date(isoStr).toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

function fmtTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString("en-GB");
}

function dayName(isoStr) {
  return new Date(isoStr).toLocaleDateString("en-GB", { weekday: "long" });
}

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function s1(v) {
  return Number(v).toFixed(1);
}

function setEl(id, v) {
  const e = document.getElementById(id);
  if (e) e.textContent = v;
}

function healthScore(t, h, a) {
  const ts = Math.max(0, 100 - Math.abs(t - 22) * 4);
  const hs = Math.max(0, 100 - Math.abs(h - 50) * 2);
  const as = Math.max(0, 100 - (a / 3000) * 100);
  return Math.round((ts + hs + as) / 3);
}

function aqiBadge(v) {
  if (v < 1000) return `<span class="badge-aqi badge-clean">Clean</span>`;
  if (v < 2000) return `<span class="badge-aqi badge-moderate">Moderate</span>`;
  return `<span class="badge-aqi badge-poor">Poor</span>`;
}

function healthColor(score) {
  if (score >= 80) return "#00ff88";
  if (score >= 60) return "#00e5ff";
  if (score >= 40) return "#ffcc00";
  return "#ff4d4d";
}

/* ================================================================
   CHART INITIALISATION
================================================================ */

function buildChart(canvasId, label, color, yMin, yMax, yStep) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const rgba = color.replace("rgb(", "rgba(").replace(")", ", 0.13)");

  return new Chart(canvas.getContext("2d"), {
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
        pointBackgroundColor: color,
        fill: true,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: {
          labels: {
            color: TICK,
            font: { family: FONT, size: 13 },
            boxWidth: 26,
            padding: 12,
          }
        },
        tooltip: {
          mode: "index",
          intersect: false,
          backgroundColor: "rgba(6,16,30,0.93)",
          borderColor: color,
          borderWidth: 1,
          titleColor: TICK,
          bodyColor: "#fff",
          titleFont: { family: FONT, size: 12 },
          bodyFont:  { family: FONT, size: 13 },
          padding: 12,
        },
      },
      scales: {
        x: {
          ticks: {
            color: TICK,
            maxTicksLimit: 20,
            maxRotation: 45,
            font: { family: FONT, size: 10 },
          },
          grid: { color: GRID },
        },
        y: {
          min: yMin,
          max: yMax,
          ticks: {
            color: TICK,
            stepSize: yStep,
            maxTicksLimit: 18,
            font: { family: FONT, size: 10 },
          },
          grid: { color: GRID },
        },
      },
    },
  });
}

/* ── Build all three charts ── */
dbTempChart = buildChart("dbTempChart", "Temperature (°C)", "rgb(255,128,128)", -10,  60,   5);
dbHumChart  = buildChart("dbHumChart",  "Humidity (%)",     "rgb(0,229,255)",    0,  100,   5);
dbAqiChart  = buildChart("dbAqiChart",  "Air Quality",      "rgb(0,255,136)",    0, 3000, 250);

/* ================================================================
   CHART DATA UPDATE
================================================================ */

function updateCharts(data) {
  const labels = data.map(d => fmtTime(d.created_at));
  const temps  = data.map(d => d.temperature);
  const hums   = data.map(d => d.humidity);
  const aqis   = data.map(d => d.air_quality);

  [[dbTempChart, temps], [dbHumChart, hums], [dbAqiChart, aqis]].forEach(([chart, vals]) => {
    if (!chart) return;
    chart.data.labels             = labels;
    chart.data.datasets[0].data   = vals;
    chart.update();
  });
}

/* ================================================================
   SUMMARY CARDS UPDATE
================================================================ */

function updateSummary(data) {
  const empty = () => ["scTempAvg","scTempMin","scTempMax","scTempCount",
    "scHumAvg","scHumMin","scHumMax","scHumCount",
    "scAqiAvg","scAqiMin","scAqiMax","scAqiCount",
    "scHealthVal","scHealthMin","scHealthMax","scTotalRecords"
  ].forEach(id => setEl(id, "--"));

  if (!data.length) {
    empty();
    setEl("scHealthGrade", "No data");
    return;
  }

  const temps  = data.map(d => d.temperature);
  const hums   = data.map(d => d.humidity);
  const aqis   = data.map(d => d.air_quality);
  const scores = data.map(d => healthScore(d.temperature, d.humidity, d.air_quality));
  const avgScore = Math.round(avg(scores));

  setEl("scTempAvg",   s1(avg(temps)) + "°C");
  setEl("scTempMin",   s1(Math.min(...temps)));
  setEl("scTempMax",   s1(Math.max(...temps)));
  setEl("scTempCount", data.length);

  setEl("scHumAvg",   s1(avg(hums)) + "%");
  setEl("scHumMin",   s1(Math.min(...hums)));
  setEl("scHumMax",   s1(Math.max(...hums)));
  setEl("scHumCount", data.length);

  setEl("scAqiAvg",   Math.round(avg(aqis)));
  setEl("scAqiMin",   Math.round(Math.min(...aqis)));
  setEl("scAqiMax",   Math.round(Math.max(...aqis)));
  setEl("scAqiCount", data.length);

  setEl("scHealthVal",    avgScore);
  setEl("scHealthMin",    Math.min(...scores));
  setEl("scHealthMax",    Math.max(...scores));
  setEl("scTotalRecords", data.length);

  let grade = "--";
  if (avgScore >= 80)      grade = "EXCELLENT";
  else if (avgScore >= 60) grade = "GOOD";
  else if (avgScore >= 40) grade = "MODERATE";
  else                     grade = "POOR";

  setEl("scHealthGrade", grade);

  const valEl = document.getElementById("scHealthVal");
  if (valEl) valEl.style.color = healthColor(avgScore);
  const gradeEl = document.getElementById("scHealthGrade");
  if (gradeEl) gradeEl.style.color = healthColor(avgScore);
}

/* ================================================================
   DATA TABLE RENDER  (paginated)
================================================================ */

function renderTable(data) {
  const container  = document.getElementById("tableContainer");
  const pagination = document.getElementById("pagination");

  if (!data.length) {
    container.innerHTML = `
      <div class="state-box">
        <span class="state-icon">📭</span>
        No records found for this date.
        <div class="state-sub">Try a different date or check your API connection.</div>
      </div>`;
    pagination.innerHTML = "";
    setEl("tableInfo", "0 records");
    return;
  }

  const totalPages = Math.ceil(data.length / ROWS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * ROWS_PER_PAGE;
  const end   = Math.min(start + ROWS_PER_PAGE, data.length);
  const page  = data.slice(start, end);

  setEl("tableInfo", `Showing ${start + 1}–${end} of ${data.length} records`);

  const rows = page.map((d, i) => {
    const hs       = healthScore(d.temperature, d.humidity, d.air_quality);
    const aqiClass = d.air_quality < 1000 ? "td-clean" : d.air_quality < 2000 ? "td-moderate" : "td-poor";
    const hColor   = healthColor(hs);
    return `
      <tr>
        <td class="td-time">${start + i + 1}</td>
        <td class="td-time">${fmtTime(d.created_at)}</td>
        <td class="td-temp">${s1(d.temperature)} °C</td>
        <td class="td-hum">${s1(d.humidity)} %</td>
        <td class="${aqiClass}">${d.air_quality} ${aqiBadge(d.air_quality)}</td>
        <td style="color:${hColor}; font-weight:600">${hs}</td>
      </tr>`;
  }).join("");

  container.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>Temperature</th>
            <th>Humidity</th>
            <th>Air Quality</th>
            <th>Health Score</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  buildPagination(totalPages);
}

function buildPagination(totalPages) {
  const pagination = document.getElementById("pagination");
  const RANGE = 5;
  const half  = Math.floor(RANGE / 2);
  let   pStart = Math.max(1, currentPage - half);
  let   pEnd   = Math.min(totalPages, pStart + RANGE - 1);
  if (pEnd - pStart < RANGE - 1) pStart = Math.max(1, pEnd - RANGE + 1);

  let html = "";

  html += `<button class="pg-btn" onclick="goPage(${currentPage - 1})" ${currentPage <= 1 ? "disabled" : ""}>&#8592; Prev</button>`;

  if (pStart > 1) {
    html += `<button class="pg-btn" onclick="goPage(1)">1</button>`;
    if (pStart > 2) html += `<span class="pg-info">…</span>`;
  }

  for (let p = pStart; p <= pEnd; p++) {
    html += `<button class="pg-btn ${p === currentPage ? "active" : ""}" onclick="goPage(${p})">${p}</button>`;
  }

  if (pEnd < totalPages) {
    if (pEnd < totalPages - 1) html += `<span class="pg-info">…</span>`;
    html += `<button class="pg-btn" onclick="goPage(${totalPages})">${totalPages}</button>`;
  }

  html += `<button class="pg-btn" onclick="goPage(${currentPage + 1})" ${currentPage >= totalPages ? "disabled" : ""}>Next &#8594;</button>`;
  html += `<span class="pg-info">Page ${currentPage} of ${totalPages}</span>`;

  pagination.innerHTML = html;
}

window.goPage = function (p) {
  const total = Math.ceil(filteredData.length / ROWS_PER_PAGE);
  if (p < 1 || p > total) return;
  currentPage = p;
  renderTable(filteredData);
  document.querySelector(".table-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

/* ================================================================
   FETCH DATA FOR A DATE
================================================================ */

async function loadDate(dateStr) {
  selectedDate = dateStr;

  document.getElementById("tableContainer").innerHTML = `
    <div class="state-box">
      <div class="spinner"></div>
      Fetching data for ${fmtDate(dateStr + "T12:00:00")}…
    </div>`;
  document.getElementById("pagination").innerHTML = "";

  try {
    let data = [];

    /* Try date-filtered endpoint first */
    try {
      const res = await fetch(`${API}/history?date=${dateStr}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length) data = json;
      }
    } catch (_) { /* endpoint may not support ?date */ }

    /* Fall back: fetch all, filter client-side by date */
    if (!data.length) {
      const res = await fetch(`${API}/history`);
      if (res.ok) {
        const all = await res.json();
        if (Array.isArray(all)) {
          data = all.filter(d => {
            return new Date(d.created_at).toISOString().split("T")[0] === dateStr;
          });
        }
      }
    }

    allData      = data;
    filteredData = data;
    currentPage  = 1;

    setEl("recordCount", data.length + " records");
    updateSummary(data);
    updateCharts(data);
    renderTable(data);

  } catch (err) {
    document.getElementById("tableContainer").innerHTML = `
      <div class="state-box">
        <span class="state-icon">⚠</span>
        Failed to load data.
        <div class="state-sub">${err.message}</div>
      </div>`;
    setEl("recordCount", "Error");
  }
}

/* ================================================================
   CSV EXPORT
   File name format: sensor-data-Wednesday-2025-01-15.csv
   Download attribute set to exports/ subfolder path so browser
   saves into exports/ directory within the project folder.
================================================================ */

document.getElementById("csvBtn").addEventListener("click", () => {
  if (!allData.length) {
    alert("No data to export for this date.");
    return;
  }

  const day   = dayName(selectedDate + "T12:00:00");
  const fname = `sensor-data-${day}-${selectedDate}.csv`;

  let csv = "Time,Temperature (°C),Humidity (%),Air Quality,Health Score,AQI Status\n";
  allData.forEach(d => {
    const hs     = healthScore(d.temperature, d.humidity, d.air_quality);
    const status = d.air_quality < 1000 ? "Clean" : d.air_quality < 2000 ? "Moderate" : "Poor";
    csv += `${fmtTime(d.created_at)},${d.temperature},${d.humidity},${d.air_quality},${hs},${status}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `exports/${fname}`;   /* saves into exports/ folder */
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

/* ================================================================
   DATE PICKER
================================================================ */

const picker = document.getElementById("datePicker");
picker.value = todayStr();
picker.max   = todayStr();

picker.addEventListener("change", () => {
  document.querySelectorAll(".qd-btn").forEach(b => b.classList.remove("active"));
  loadDate(picker.value);
});

/* ================================================================
   QUICK DATE BUTTONS  (Today / Yesterday / 7 days ago)
================================================================ */

document.querySelectorAll(".qd-btn").forEach(btn => {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".qd-btn").forEach(b => b.classList.remove("active"));
    this.classList.add("active");

    const offset = parseInt(this.dataset.offset, 10);
    const d      = new Date();
    d.setDate(d.getDate() - offset);
    const str = d.toISOString().split("T")[0];

    picker.value = str;
    loadDate(str);
  });
});

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

document.getElementById("themeToggle").addEventListener("click", function () {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
  this.classList.toggle("light-mode", dark);
});

/* ================================================================
   PARTICLE BACKGROUND  (reuses bgCanvas from shared style)
================================================================ */

(function particleBg() {
  const cv = document.getElementById("bgCanvas");
  if (!cv) return;
  const c = cv.getContext("2d");
  let W, H;

  function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
  resize();
  window.addEventListener("resize", resize);

  /* network dots */
  const DOTS = Array.from({ length: 60 }, () => ({
    x:  Math.random() * 1920,
    y:  Math.random() * 1080,
    vx: (Math.random() - 0.5) * 0.16,
    vy: (Math.random() - 0.5) * 0.16,
    r:  Math.random() * 1.3 + 0.35,
    a:  Math.random() * 0.38 + 0.14,
  }));

  /* floating env symbols */
  const TYPES = ["drop", "drop", "ring", "hex", "therm", "dot"];

  function newSym() {
    return {
      t:       TYPES[Math.floor(Math.random() * TYPES.length)],
      x:       Math.random() * 1920,
      y:       H + 50 + Math.random() * 150,
      vx:      (Math.random() - 0.5) * 0.1,
      vy:      -(Math.random() * 0.28 + 0.08),
      sz:      Math.random() * 13 + 5,
      life:    0,
      maxLife: Math.random() * 650 + 250,
      hue:     [180, 190, 160, 200, 130][Math.floor(Math.random() * 5)],
    };
  }

  const SYMS = Array.from({ length: 38 }, () => {
    const s = newSym();
    s.y    = Math.random() * H;
    s.life = Math.random() * s.maxLife;
    return s;
  });

  /* symbol draw functions */
  function drawDrop(x, y, sz, a, hue) {
    c.save(); c.translate(x, y); c.globalAlpha = a;
    c.strokeStyle = `hsl(${hue},90%,65%)`; c.lineWidth = 0.9;
    c.shadowColor = `hsl(${hue},90%,65%)`; c.shadowBlur = 7;
    c.beginPath();
    c.moveTo(0, -sz);
    c.bezierCurveTo( sz * 0.85, -sz * 0.15,  sz * 0.85, sz * 0.5, 0, sz * 0.82);
    c.bezierCurveTo(-sz * 0.85,  sz * 0.5, -sz * 0.85, -sz * 0.15, 0, -sz);
    c.stroke(); c.restore();
  }

  function drawTherm(x, y, sz, a) {
    c.save(); c.translate(x, y); c.globalAlpha = a;
    c.strokeStyle = `rgba(255,110,80,${a})`; c.lineWidth = 1.1;
    c.shadowColor = "#ff4d4d"; c.shadowBlur = 6;
    c.beginPath();
    c.moveTo(-sz * 0.17, -sz); c.lineTo(sz * 0.17, -sz);
    c.lineTo(sz * 0.17, sz * 0.35); c.lineTo(-sz * 0.17, sz * 0.35);
    c.closePath(); c.stroke();
    c.beginPath(); c.arc(0, sz * 0.5, sz * 0.3, 0, 6.28);
    c.fillStyle = `rgba(255,77,77,${a * 0.55})`; c.fill();
    c.restore();
  }

  function drawRing(x, y, sz, a, hue) {
    c.save(); c.translate(x, y); c.globalAlpha = a;
    c.strokeStyle = `hsl(${hue},90%,60%)`; c.lineWidth = 0.8;
    c.shadowColor = `hsl(${hue},90%,60%)`; c.shadowBlur = 9;
    c.beginPath(); c.arc(0, 0, sz, 0, 6.28); c.stroke();
    c.globalAlpha = a * 0.4;
    c.beginPath(); c.arc(0, 0, sz * 0.5, 0, 6.28); c.stroke();
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * 6.28;
      c.globalAlpha = a * 0.6;
      c.beginPath(); c.arc(Math.cos(ang) * sz, Math.sin(ang) * sz, sz * 0.1, 0, 6.28);
      c.fillStyle = `hsl(${hue},90%,70%)`; c.fill();
    }
    c.restore();
  }

  function drawHex(x, y, sz, a) {
    c.save(); c.translate(x, y); c.globalAlpha = a * 0.3;
    c.strokeStyle = "rgba(0,229,255,1)"; c.lineWidth = 0.6;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * 6.28 - Math.PI / 6;
      i ? c.lineTo(Math.cos(ang) * sz, Math.sin(ang) * sz)
        : c.moveTo(Math.cos(ang) * sz, Math.sin(ang) * sz);
    }
    c.closePath(); c.stroke(); c.restore();
  }

  function drawDot(x, y, sz, a, hue) {
    c.save(); c.globalAlpha = a;
    c.beginPath(); c.arc(x, y, sz * 0.22, 0, 6.28);
    c.fillStyle = `hsl(${hue},90%,65%)`;
    c.shadowColor = `hsl(${hue},90%,65%)`; c.shadowBlur = sz * 1.6;
    c.fill(); c.restore();
  }

  /* hex grid overlay */
  let hp = 0;
  function hexGrid() {
    hp += 0.004;
    const gs = 72;
    const cols = Math.ceil(W / (gs * 1.5)) + 2;
    const rows = Math.ceil(H / (gs * 0.866)) + 2;
    c.save(); c.globalAlpha = 0.016 + Math.sin(hp) * 0.005;
    c.strokeStyle = "#00e5ff"; c.lineWidth = 0.5;
    for (let col = -1; col < cols; col++) {
      for (let row = -1; row < rows; row++) {
        const cx = col * gs * 1.5;
        const cy = row * gs * 0.866 + (col % 2 ? gs * 0.433 : 0);
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * 6.28 - Math.PI / 6;
          const px = cx + Math.cos(ang) * gs * 0.47;
          const py = cy + Math.sin(ang) * gs * 0.47;
          i ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.closePath(); c.stroke();
      }
    }
    c.restore();
  }

  /* main draw loop */
  (function draw() {
    c.clearRect(0, 0, W, H);
    const light = document.documentElement.getAttribute("data-theme") === "light";

    if (!light) hexGrid();

    /* network mesh */
    DOTS.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.28);
      c.fillStyle = light ? `rgba(0,80,180,${p.a * 0.2})` : `rgba(0,229,255,${p.a * 0.22})`;
      c.fill();
    });

    for (let i = 0; i < DOTS.length; i++) {
      for (let j = i + 1; j < DOTS.length; j++) {
        const dx = DOTS[i].x - DOTS[j].x, dy = DOTS[i].y - DOTS[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 125) {
          c.beginPath();
          c.moveTo(DOTS[i].x, DOTS[i].y); c.lineTo(DOTS[j].x, DOTS[j].y);
          c.strokeStyle = light
            ? `rgba(0,80,180,${0.045 * (1 - d / 125)})`
            : `rgba(0,229,255,${0.045 * (1 - d / 125)})`;
          c.lineWidth = 0.5; c.stroke();
        }
      }
    }

    /* floating env symbols — dark mode only */
    if (!light) {
      SYMS.forEach(s => {
        s.x += s.vx; s.y += s.vy; s.life++;
        const t  = s.life / s.maxLife;
        const fa = (t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1) * 0.2;
        if (s.t === "drop")  drawDrop(s.x, s.y, s.sz, fa, s.hue);
        if (s.t === "therm") drawTherm(s.x, s.y, s.sz, fa);
        if (s.t === "ring")  drawRing(s.x, s.y, s.sz, fa, s.hue);
        if (s.t === "hex")   drawHex(s.x, s.y, s.sz, fa);
        if (s.t === "dot")   drawDot(s.x, s.y, s.sz, fa, s.hue);
        if (s.life >= s.maxLife || s.y < -120 || s.x < -120 || s.x > W + 120) {
          Object.assign(s, newSym());
        }
      });
    }

    requestAnimationFrame(draw);
  })();
})();

/* ================================================================
   INITIAL LOAD
================================================================ */
loadDate(todayStr());