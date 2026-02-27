/* ================================================================
   dashboard.js — ENVCORE Historical Dashboard
   FIXES:
   • Fetches ALL /api/history records, not capped at 20
   • Proper date filtering client-side (server may not support ?date)
   • Auto-refreshes every 30s so new data appears live
   • CSV named: exports/sensor-data-Wednesday-2026-02-26.csv
   • Date toggling works: any date change triggers full reload
================================================================ */

const API          = "http://localhost:5000/api";
const ROWS_PER_PAGE = 50;   /* show 50 rows per page in table */

const FONT = "Rajdhani";
const TICK = "rgba(200,232,255,0.72)";
const GRID = "rgba(255,255,255,0.06)";

/* ── App state ── */
let allData      = [];   /* all records for selected date */
let currentPage  = 1;
let selectedDate = todayStr();
let refreshTimer = null;

/* ── Charts ── */
let dbTempChart = null;
let dbHumChart  = null;
let dbAqiChart  = null;

/* ================================================================
   UTILS
================================================================ */
function todayStr() {
  /* YYYY-MM-DD in local timezone */
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function localDateStr(isoStr) {
  /* Extract YYYY-MM-DD in local timezone from any ISO string */
  const d = new Date(isoStr);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function fmtTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString("en-GB");
}

function fmtDateLong(dateStr) {
  /* dateStr = "YYYY-MM-DD" */
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

function dayName(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long" });
}

function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function s1(v)    { return Number(v).toFixed(1); }

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

function healthColor(s) {
  if (s >= 80) return "#00ff88";
  if (s >= 60) return "#00e5ff";
  if (s >= 40) return "#ffcc00";
  return "#ff4d4d";
}

/* ================================================================
   CHART INIT
================================================================ */
function buildChart(id, label, color, yMin, yMax, yStep) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  const fill = color.replace("rgb(", "rgba(").replace(")", ",0.13)");
  return new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels: [], datasets: [{ label, borderColor: color, backgroundColor: fill,
      data: [], tension: 0.4, pointRadius: 2, pointHoverRadius: 6,
      pointBackgroundColor: color, fill: true, borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: { labels: { color: TICK, font: { family: FONT, size: 13 }, boxWidth: 26, padding: 12 } },
        tooltip: { mode: "index", intersect: false, backgroundColor: "rgba(6,16,30,0.93)",
          borderColor: color, borderWidth: 1, titleColor: TICK, bodyColor: "#fff",
          titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12 },
      },
      scales: {
        x: { ticks: { color: TICK, maxTicksLimit: 24, maxRotation: 45, font: { family: FONT, size: 10 } }, grid: { color: GRID } },
        y: { min: yMin, max: yMax,
          ticks: { color: TICK, stepSize: yStep, maxTicksLimit: 18, font: { family: FONT, size: 10 } },
          grid: { color: GRID } },
      },
    },
  });
}

dbTempChart = buildChart("dbTempChart", "Temperature (°C)", "rgb(255,128,128)", -10,  60,   5);
dbHumChart  = buildChart("dbHumChart",  "Humidity (%)",     "rgb(0,229,255)",    0,  100,   5);
dbAqiChart  = buildChart("dbAqiChart",  "Air Quality",      "rgb(0,255,136)",    0, 3000, 250);

/* ================================================================
   UPDATE CHARTS
================================================================ */
function updateCharts(data) {
  /* For chart readability: sample if too many points */
  const MAX_CHART_PTS = 200;
  let chartData = data;
  if (data.length > MAX_CHART_PTS) {
    const step = Math.ceil(data.length / MAX_CHART_PTS);
    chartData = data.filter((_, i) => i % step === 0 || i === data.length - 1);
  }

  const labels = chartData.map(d => fmtTime(d.created_at));
  const temps  = chartData.map(d => d.temperature);
  const hums   = chartData.map(d => d.humidity);
  const aqis   = chartData.map(d => d.air_quality);

  [[dbTempChart, temps], [dbHumChart, hums], [dbAqiChart, aqis]].forEach(([chart, vals]) => {
    if (!chart) return;
    chart.data.labels           = labels;
    chart.data.datasets[0].data = vals;
    chart.update();
  });
}

/* ================================================================
   SUMMARY CARDS
================================================================ */
function updateSummary(data) {
  const ids = ["scTempAvg","scTempMin","scTempMax","scTempCount",
    "scHumAvg","scHumMin","scHumMax","scHumCount",
    "scAqiAvg","scAqiMin","scAqiMax","scAqiCount",
    "scHealthVal","scHealthMin","scHealthMax","scTotalRecords"];

  if (!data.length) {
    ids.forEach(id => setEl(id, "--"));
    setEl("scHealthGrade", "No data");
    return;
  }

  const temps  = data.map(d => d.temperature);
  const hums   = data.map(d => d.humidity);
  const aqis   = data.map(d => d.air_quality);
  const scores = data.map(d => healthScore(d.temperature, d.humidity, d.air_quality));
  const avgS   = Math.round(avg(scores));

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

  setEl("scHealthVal",    avgS);
  setEl("scHealthMin",    Math.min(...scores));
  setEl("scHealthMax",    Math.max(...scores));
  setEl("scTotalRecords", data.length);

  let grade = "POOR";
  if      (avgS >= 80) grade = "EXCELLENT";
  else if (avgS >= 60) grade = "GOOD";
  else if (avgS >= 40) grade = "MODERATE";

  setEl("scHealthGrade", grade);
  const valEl   = document.getElementById("scHealthVal");
  const gradeEl = document.getElementById("scHealthGrade");
  const col     = healthColor(avgS);
  if (valEl)   valEl.style.color   = col;
  if (gradeEl) gradeEl.style.color = col;
}

/* ================================================================
   TABLE RENDER
================================================================ */
function renderTable(data) {
  const container  = document.getElementById("tableContainer");
  const pagination = document.getElementById("pagination");
  if (!container || !pagination) return;

  if (!data.length) {
    container.innerHTML = `
      <div class="state-box">
        <span class="state-icon">📭</span>
        No records found for ${fmtDateLong(selectedDate)}.
        <div class="state-sub">Check your database or select a different date.</div>
      </div>`;
    pagination.innerHTML = "";
    setEl("tableInfo", "0 records");
    return;
  }

  const totalPages = Math.ceil(data.length / ROWS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1)          currentPage = 1;

  const start = (currentPage - 1) * ROWS_PER_PAGE;
  const end   = Math.min(start + ROWS_PER_PAGE, data.length);
  const page  = data.slice(start, end);

  setEl("tableInfo", `Showing ${start+1}–${end} of ${data.length} records`);

  const rows = page.map((d, i) => {
    const hs       = healthScore(d.temperature, d.humidity, d.air_quality);
    const aqiClass = d.air_quality < 1000 ? "td-clean" : d.air_quality < 2000 ? "td-moderate" : "td-poor";
    return `<tr>
      <td class="td-time">${start+i+1}</td>
      <td class="td-time">${fmtTime(d.created_at)}</td>
      <td class="td-temp">${s1(d.temperature)} °C</td>
      <td class="td-hum">${s1(d.humidity)} %</td>
      <td class="${aqiClass}">${d.air_quality} ${aqiBadge(d.air_quality)}</td>
      <td style="color:${healthColor(hs)};font-weight:600">${hs}</td>
    </tr>`;
  }).join("");

  container.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr>
          <th>#</th><th>Time</th><th>Temperature</th>
          <th>Humidity</th><th>Air Quality</th><th>Health Score</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  /* Build pagination */
  const R = 5, H = Math.floor(R/2);
  let ps = Math.max(1, currentPage - H);
  let pe = Math.min(totalPages, ps + R - 1);
  if (pe - ps < R - 1) ps = Math.max(1, pe - R + 1);

  let pg = "";
  pg += `<button class="pg-btn" onclick="goPage(${currentPage-1})" ${currentPage<=1?"disabled":""}>&#8592; Prev</button>`;
  if (ps > 1) { pg += `<button class="pg-btn" onclick="goPage(1)">1</button>`; if (ps > 2) pg += `<span class="pg-info">…</span>`; }
  for (let p = ps; p <= pe; p++) pg += `<button class="pg-btn${p===currentPage?" active":""}" onclick="goPage(${p})">${p}</button>`;
  if (pe < totalPages) { if (pe < totalPages-1) pg += `<span class="pg-info">…</span>`; pg += `<button class="pg-btn" onclick="goPage(${totalPages})">${totalPages}</button>`; }
  pg += `<button class="pg-btn" onclick="goPage(${currentPage+1})" ${currentPage>=totalPages?"disabled":""}>Next &#8594;</button>`;
  pg += `<span class="pg-info">Page ${currentPage} of ${totalPages}</span>`;
  pagination.innerHTML = pg;
}

window.goPage = function(p) {
  const total = Math.ceil(allData.length / ROWS_PER_PAGE);
  if (p < 1 || p > total) return;
  currentPage = p;
  renderTable(allData);
  document.querySelector(".table-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

/* ================================================================
   LOAD DATE — main data fetch
   Strategy:
   1. Try GET /api/history?date=YYYY-MM-DD  (if server supports it)
   2. Fall back: GET /api/history (all records) then filter client-side
   This guarantees we get ALL data regardless of server capabilities.
================================================================ */
async function loadDate(dateStr, silent = false) {
  selectedDate = dateStr;
  currentPage  = 1;

  if (!silent) {
    document.getElementById("tableContainer").innerHTML = `
      <div class="state-box">
        <div class="spinner"></div>
        Loading ${fmtDateLong(dateStr)}…
      </div>`;
    document.getElementById("pagination").innerHTML = "";
    setEl("recordCount", "Loading…");
  }

  try {
    let data = [];

    /* 1 — Try date-filtered endpoint */
    try {
      const r = await fetch(`${API}/history?date=${dateStr}`, { signal: AbortSignal.timeout(6000) });
      if (r.ok) {
        const j = await r.json();
        if (Array.isArray(j) && j.length > 0) {
          /* Verify results actually match the requested date */
          const filtered = j.filter(d => localDateStr(d.created_at) === dateStr);
          if (filtered.length > 0) data = filtered;
        }
      }
    } catch (_) { /* endpoint doesn't support ?date */ }

    /* 2 — Fall back: fetch ALL and filter client-side */
    if (data.length === 0) {
      const r = await fetch(`${API}/history`, { signal: AbortSignal.timeout(10000) });
      if (r.ok) {
        const all = await r.json();
        if (Array.isArray(all)) {
          data = all.filter(d => localDateStr(d.created_at) === dateStr);
        }
      }
    }

    /* Sort ascending by time */
    data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    allData = data;
    setEl("recordCount", data.length + " records");
    updateSummary(data);
    updateCharts(data);
    renderTable(data);

  } catch (err) {
    document.getElementById("tableContainer").innerHTML = `
      <div class="state-box">
        <span class="state-icon">⚠</span>
        Could not reach backend.
        <div class="state-sub">${err.message}</div>
      </div>`;
    setEl("recordCount", "Error");
  }
}

/* ================================================================
   AUTO-REFRESH — reload current date's data every 30 seconds
   So today's page keeps accumulating new readings live.
================================================================ */
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    /* Silent refresh — don't show loading spinner */
    loadDate(selectedDate, true);
  }, 30000);
}

/* ================================================================
   CSV EXPORT
================================================================ */
document.getElementById("csvBtn")?.addEventListener("click", () => {
  if (!allData.length) { alert("No data to export for this date."); return; }

  const day   = dayName(selectedDate);
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
  a.download = `exports/${fname}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

/* ================================================================
   DATE PICKER
================================================================ */
const picker = document.getElementById("datePicker");
if (picker) {
  picker.value = todayStr();
  picker.max   = todayStr();
  picker.addEventListener("change", () => {
    /* Deactivate all quick date buttons */
    document.querySelectorAll(".qd-btn").forEach(b => b.classList.remove("active"));
    loadDate(picker.value);
    startAutoRefresh();
  });
}

/* ================================================================
   QUICK DATE BUTTONS
================================================================ */
document.querySelectorAll(".qd-btn").forEach(btn => {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".qd-btn").forEach(b => b.classList.remove("active"));
    this.classList.add("active");
    const offset = parseInt(this.dataset.offset, 10);
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const y   = d.getFullYear();
    const m   = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    const str = `${y}-${m}-${day}`;
    if (picker) picker.value = str;
    loadDate(str);
    startAutoRefresh();
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
   THEME
================================================================ */
document.getElementById("themeToggle")?.addEventListener("click", function () {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
  this.classList.toggle("light-mode", dark);
});

/* ================================================================
   PARTICLE BG
================================================================ */
(function particleBg() {
  const cv = document.getElementById("bgCanvas");
  if (!cv) return;
  const c = cv.getContext("2d");
  let W, H;
  function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
  resize(); window.addEventListener("resize", resize);

  const DOTS = Array.from({ length: 55 }, () => ({
    x:Math.random()*1920, y:Math.random()*1080,
    vx:(Math.random()-.5)*.16, vy:(Math.random()-.5)*.16,
    r:Math.random()*1.3+.35, a:Math.random()*.38+.14,
  }));

  const TYPES = ["drop","drop","ring","hex","therm","dot"];
  function newSym() {
    return { t:TYPES[Math.floor(Math.random()*TYPES.length)],
      x:Math.random()*1920, y:H+50+Math.random()*150,
      vx:(Math.random()-.5)*.1, vy:-(Math.random()*.28+.08),
      sz:Math.random()*13+5, life:0, maxLife:Math.random()*650+250,
      hue:[180,190,160,200,130][Math.floor(Math.random()*5)] };
  }
  const SYMS = Array.from({ length: 35 }, () => {
    const s = newSym(); s.y = Math.random()*H; s.life = Math.random()*s.maxLife; return s;
  });

  function drawDrop(x,y,sz,a,hue){ c.save();c.translate(x,y);c.globalAlpha=a;c.strokeStyle=`hsl(${hue},90%,65%)`;c.lineWidth=.9;c.shadowColor=`hsl(${hue},90%,65%)`;c.shadowBlur=7;c.beginPath();c.moveTo(0,-sz);c.bezierCurveTo(sz*.85,-sz*.15,sz*.85,sz*.5,0,sz*.82);c.bezierCurveTo(-sz*.85,sz*.5,-sz*.85,-sz*.15,0,-sz);c.stroke();c.restore(); }
  function drawTherm(x,y,sz,a){ c.save();c.translate(x,y);c.globalAlpha=a;c.strokeStyle=`rgba(255,110,80,${a})`;c.lineWidth=1.1;c.shadowColor="#ff4d4d";c.shadowBlur=6;c.beginPath();c.moveTo(-sz*.17,-sz);c.lineTo(sz*.17,-sz);c.lineTo(sz*.17,sz*.35);c.lineTo(-sz*.17,sz*.35);c.closePath();c.stroke();c.beginPath();c.arc(0,sz*.5,sz*.3,0,6.28);c.fillStyle=`rgba(255,77,77,${a*.55})`;c.fill();c.restore(); }
  function drawRing(x,y,sz,a,hue){ c.save();c.translate(x,y);c.globalAlpha=a;c.strokeStyle=`hsl(${hue},90%,60%)`;c.lineWidth=.8;c.shadowColor=`hsl(${hue},90%,60%)`;c.shadowBlur=9;c.beginPath();c.arc(0,0,sz,0,6.28);c.stroke();c.globalAlpha=a*.4;c.beginPath();c.arc(0,0,sz*.5,0,6.28);c.stroke();for(let i=0;i<6;i++){const ang=i/6*6.28;c.globalAlpha=a*.6;c.beginPath();c.arc(Math.cos(ang)*sz,Math.sin(ang)*sz,sz*.1,0,6.28);c.fillStyle=`hsl(${hue},90%,70%)`;c.fill();}c.restore(); }
  function drawHex(x,y,sz,a){ c.save();c.translate(x,y);c.globalAlpha=a*.3;c.strokeStyle="rgba(0,229,255,1)";c.lineWidth=.6;c.beginPath();for(let i=0;i<6;i++){const ang=i/6*6.28-Math.PI/6;i?c.lineTo(Math.cos(ang)*sz,Math.sin(ang)*sz):c.moveTo(Math.cos(ang)*sz,Math.sin(ang)*sz);}c.closePath();c.stroke();c.restore(); }
  function drawDot(x,y,sz,a,hue){ c.save();c.globalAlpha=a;c.beginPath();c.arc(x,y,sz*.22,0,6.28);c.fillStyle=`hsl(${hue},90%,65%)`;c.shadowColor=`hsl(${hue},90%,65%)`;c.shadowBlur=sz*1.6;c.fill();c.restore(); }

  let hp = 0;
  function hexGrid() {
    hp += .004;
    const gs=72,cols=Math.ceil(W/(gs*1.5))+2,rows=Math.ceil(H/(gs*.866))+2;
    c.save();c.globalAlpha=.016+Math.sin(hp)*.005;c.strokeStyle="#00e5ff";c.lineWidth=.5;
    for(let col=-1;col<cols;col++) for(let row=-1;row<rows;row++){
      const cx=col*gs*1.5,cy=row*gs*.866+(col%2?gs*.433:0);
      c.beginPath();
      for(let i=0;i<6;i++){const ang=i/6*6.28-Math.PI/6;const px=cx+Math.cos(ang)*gs*.47,py=cy+Math.sin(ang)*gs*.47;i?c.lineTo(px,py):c.moveTo(px,py);}
      c.closePath();c.stroke();
    }
    c.restore();
  }

  (function draw() {
    c.clearRect(0,0,W,H);
    const light = document.documentElement.getAttribute("data-theme")==="light";
    if (!light) hexGrid();
    DOTS.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;
      c.beginPath();c.arc(p.x,p.y,p.r,0,6.28);
      c.fillStyle=light?`rgba(0,80,180,${p.a*.2})`:`rgba(0,229,255,${p.a*.22})`;c.fill();
    });
    for(let i=0;i<DOTS.length;i++) for(let j=i+1;j<DOTS.length;j++){
      const dx=DOTS[i].x-DOTS[j].x,dy=DOTS[i].y-DOTS[j].y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<125){ c.beginPath();c.moveTo(DOTS[i].x,DOTS[i].y);c.lineTo(DOTS[j].x,DOTS[j].y);
        c.strokeStyle=light?`rgba(0,80,180,${.045*(1-d/125)})`:`rgba(0,229,255,${.045*(1-d/125)})`;
        c.lineWidth=.5;c.stroke(); }
    }
    if (!light) SYMS.forEach(s=>{
      s.x+=s.vx;s.y+=s.vy;s.life++;
      const t=s.life/s.maxLife;
      const fa=(t<.15?t/.15:t>.85?(1-t)/.15:1)*.2;
      if(s.t==="drop")  drawDrop(s.x,s.y,s.sz,fa,s.hue);
      if(s.t==="therm") drawTherm(s.x,s.y,s.sz,fa);
      if(s.t==="ring")  drawRing(s.x,s.y,s.sz,fa,s.hue);
      if(s.t==="hex")   drawHex(s.x,s.y,s.sz,fa);
      if(s.t==="dot")   drawDot(s.x,s.y,s.sz,fa,s.hue);
      if(s.life>=s.maxLife||s.y<-120||s.x<-120||s.x>W+120) Object.assign(s,newSym());
    });
    requestAnimationFrame(draw);
  })();
})();

/* ================================================================
   INITIAL LOAD + AUTO-REFRESH START
================================================================ */
loadDate(todayStr());
startAutoRefresh();