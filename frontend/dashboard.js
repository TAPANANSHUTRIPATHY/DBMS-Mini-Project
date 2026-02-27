/* ================================================================
   dashboard.js  — ENVCORE Historical Dashboard
   
   ROOT CAUSE FIX: /api/history returns only ~12 rows by default.
   We defeat this by trying every known URL pattern that removes
   the server-side limit, then falling back to paginating the
   API ourselves (?page=1,2,3…) until we have all records,
   then filtering client-side by the selected date.
   
   Auto-refreshes every 30 s (silent) so today's data grows live.
================================================================ */

const API = "http://localhost:5000/api";
const ROWS_PER_PAGE = 50;

const FONT = "Rajdhani";
const TICK = "rgba(200,232,255,0.72)";
const GRID = "rgba(255,255,255,0.06)";

let allData      = [];
let currentPage  = 1;
let selectedDate = todayStr();
let refreshTimer = null;

let dbTempChart = null;
let dbHumChart  = null;
let dbAqiChart  = null;

/* ================================================================
   UTILITIES
================================================================ */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
}
function p2(n) { return String(n).padStart(2,"0"); }

/* Convert any ISO / postgres timestamp → local YYYY-MM-DD */
function localDate(isoStr) {
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
}

function fmtTime(isoStr)  { return new Date(isoStr).toLocaleTimeString("en-GB"); }
function fmtLong(dateStr) {
  return new Date(dateStr+"T12:00:00").toLocaleDateString("en-GB",
    { weekday:"long", year:"numeric", month:"long", day:"numeric" });
}
function dayName(dateStr) {
  return new Date(dateStr+"T12:00:00").toLocaleDateString("en-GB",{ weekday:"long" });
}
function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function s1(v)    { return Number(v).toFixed(1); }
function setEl(id,v){ const e=document.getElementById(id); if(e) e.textContent=v; }

function healthScore(t,h,a) {
  return Math.round((Math.max(0,100-Math.abs(t-22)*4) +
                     Math.max(0,100-Math.abs(h-50)*2) +
                     Math.max(0,100-(a/3000)*100)) / 3);
}
function aqiBadge(v) {
  if (v<1000) return `<span class="badge-aqi badge-clean">Clean</span>`;
  if (v<2000) return `<span class="badge-aqi badge-moderate">Moderate</span>`;
  return `<span class="badge-aqi badge-poor">Poor</span>`;
}
function hColor(s) {
  if (s>=80) return "#00ff88";
  if (s>=60) return "#00e5ff";
  if (s>=40) return "#ffcc00";
  return "#ff4d4d";
}

/* ================================================================
   CHART INIT
================================================================ */
function buildChart(id, label, color, yMin, yMax, yStep) {
  const el = document.getElementById(id);
  if (!el) return null;
  const fill = color.replace("rgb(","rgba(").replace(")",",0.13)");
  return new Chart(el.getContext("2d"), {
    type:"line",
    data:{ labels:[], datasets:[{ label, borderColor:color, backgroundColor:fill,
      data:[], tension:0.4, pointRadius:2, pointHoverRadius:6,
      pointBackgroundColor:color, fill:true, borderWidth:2 }] },
    options:{
      responsive:true, maintainAspectRatio:false, animation:{ duration:400 },
      plugins:{
        legend:{ labels:{ color:TICK, font:{family:FONT,size:13}, boxWidth:26, padding:12 }},
        tooltip:{ mode:"index", intersect:false, backgroundColor:"rgba(6,16,30,0.93)",
          borderColor:color, borderWidth:1, titleColor:TICK, bodyColor:"#fff",
          titleFont:{family:FONT,size:12}, bodyFont:{family:FONT,size:13}, padding:12 },
      },
      scales:{
        x:{ ticks:{ color:TICK, maxTicksLimit:20, maxRotation:45, font:{family:FONT,size:10}}, grid:{color:GRID} },
        y:{ min:yMin, max:yMax,
          ticks:{ color:TICK, stepSize:yStep, maxTicksLimit:18, font:{family:FONT,size:10}},
          grid:{color:GRID} },
      },
    },
  });
}

dbTempChart = buildChart("dbTempChart","Temperature (°C)","rgb(255,128,128)",-10, 60,  5);
dbHumChart  = buildChart("dbHumChart", "Humidity (%)",    "rgb(0,229,255)",   0, 100,  5);
dbAqiChart  = buildChart("dbAqiChart", "Air Quality",     "rgb(0,255,136)",   0,3000,250);

/* ================================================================
   FETCH ALL RECORDS — defeats server-side row limits
   
   We try these strategies in order until we get data:
   1. /api/history?limit=100000          (explicit unlimited)
   2. /api/history?limit=100000&all=true (some frameworks)
   3. /api/history/all                   (alternate endpoint)
   4. Paginate /api/history?page=N&per_page=100 until empty
      → collects ALL pages automatically
   5. /api/history (plain — whatever it returns)
================================================================ */
async function fetchAllRecords() {
  const timeout = (ms) => ({ signal: AbortSignal.timeout(ms) });

  /* Strategy 1 & 2 — large limit param */
  for (const url of [
    `${API}/history?limit=100000`,
    `${API}/history?limit=100000&all=true`,
    `${API}/history?per_page=100000`,
  ]) {
    try {
      const r = await fetch(url, timeout(10000));
      if (!r.ok) continue;
      const j = await r.json();
      if (Array.isArray(j) && j.length > 15) {
        console.log(`[ENVCORE] Got ${j.length} records from ${url}`);
        return j;
      }
    } catch(_) {}
  }

  /* Strategy 3 — /all endpoint */
  try {
    const r = await fetch(`${API}/history/all`, timeout(10000));
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j) && j.length > 0) {
        console.log(`[ENVCORE] Got ${j.length} records from /history/all`);
        return j;
      }
    }
  } catch(_) {}

  /* Strategy 4 — paginate manually */
  try {
    let all = [], page = 1, perPage = 100, keepGoing = true;
    while (keepGoing) {
      const r = await fetch(`${API}/history?page=${page}&per_page=${perPage}`, timeout(8000));
      if (!r.ok) break;
      const j = await r.json();
      
      /* Handle both {data:[...]} and plain [...] responses */
      const rows = Array.isArray(j) ? j : (Array.isArray(j.data) ? j.data : []);
      if (!rows.length) break;
      
      all = all.concat(rows);
      console.log(`[ENVCORE] Pagination page ${page}: +${rows.length} rows, total ${all.length}`);
      
      /* Stop if we got fewer than perPage (last page) */
      if (rows.length < perPage) keepGoing = false;
      else page++;
      
      /* Safety cap to avoid infinite loop */
      if (page > 200) break;
    }
    if (all.length > 0) {
      console.log(`[ENVCORE] Pagination complete: ${all.length} total records`);
      return all;
    }
  } catch(_) {}

  /* Strategy 5 — plain fallback, whatever the server returns */
  try {
    const r = await fetch(`${API}/history`, timeout(8000));
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j)) {
        console.log(`[ENVCORE] Plain /history returned ${j.length} records`);
        return j;
      }
    }
  } catch(_) {}

  return [];
}

/* ================================================================
   UPDATE CHARTS
================================================================ */
function updateCharts(data) {
  /* Sample intelligently if >300 pts for chart performance */
  let pts = data;
  if (data.length > 300) {
    const step = Math.ceil(data.length / 300);
    pts = data.filter((_,i) => i % step === 0 || i === data.length-1);
  }
  const labels = pts.map(d => fmtTime(d.created_at));
  const temps  = pts.map(d => parseFloat(d.temperature));
  const hums   = pts.map(d => parseFloat(d.humidity));
  const aqis   = pts.map(d => parseFloat(d.air_quality));

  [[dbTempChart,temps],[dbHumChart,hums],[dbAqiChart,aqis]].forEach(([ch,vals]) => {
    if (!ch) return;
    ch.data.labels = labels; ch.data.datasets[0].data = vals; ch.update();
  });
}

/* ================================================================
   SUMMARY CARDS
================================================================ */
function updateSummary(data) {
  const blank = () => ["scTempAvg","scTempMin","scTempMax","scTempCount",
    "scHumAvg","scHumMin","scHumMax","scHumCount",
    "scAqiAvg","scAqiMin","scAqiMax","scAqiCount",
    "scHealthVal","scHealthMin","scHealthMax","scTotalRecords"].forEach(id=>setEl(id,"--"));

  if (!data.length) { blank(); setEl("scHealthGrade","No data"); return; }

  const T = data.map(d=>parseFloat(d.temperature));
  const H = data.map(d=>parseFloat(d.humidity));
  const A = data.map(d=>parseFloat(d.air_quality));
  const S = data.map(d=>healthScore(d.temperature,d.humidity,d.air_quality));
  const avgS = Math.round(avg(S));

  setEl("scTempAvg", s1(avg(T))+"°C"); setEl("scTempMin",s1(Math.min(...T))); setEl("scTempMax",s1(Math.max(...T))); setEl("scTempCount",data.length);
  setEl("scHumAvg",  s1(avg(H))+"%");  setEl("scHumMin", s1(Math.min(...H))); setEl("scHumMax", s1(Math.max(...H))); setEl("scHumCount",data.length);
  setEl("scAqiAvg",  Math.round(avg(A))); setEl("scAqiMin",Math.round(Math.min(...A))); setEl("scAqiMax",Math.round(Math.max(...A))); setEl("scAqiCount",data.length);
  setEl("scHealthVal",avgS); setEl("scHealthMin",Math.min(...S)); setEl("scHealthMax",Math.max(...S)); setEl("scTotalRecords",data.length);

  const grade = avgS>=80?"EXCELLENT":avgS>=60?"GOOD":avgS>=40?"MODERATE":"POOR";
  setEl("scHealthGrade",grade);
  const col = hColor(avgS);
  const ve=document.getElementById("scHealthVal"), ge=document.getElementById("scHealthGrade");
  if(ve) ve.style.color=col; if(ge) ge.style.color=col;
}

/* ================================================================
   TABLE RENDER  (paginated)
================================================================ */
function renderTable(data) {
  const box  = document.getElementById("tableContainer");
  const pgEl = document.getElementById("pagination");
  if (!box || !pgEl) return;

  if (!data.length) {
    box.innerHTML = `<div class="state-box"><span class="state-icon">📭</span>
      No records for ${fmtLong(selectedDate)}.
      <div class="state-sub">Check your database or pick another date.</div></div>`;
    pgEl.innerHTML = ""; setEl("tableInfo","0 records"); return;
  }

  const total = Math.ceil(data.length / ROWS_PER_PAGE);
  currentPage = Math.max(1, Math.min(currentPage, total));

  const start = (currentPage-1)*ROWS_PER_PAGE;
  const end   = Math.min(start+ROWS_PER_PAGE, data.length);
  setEl("tableInfo", `Showing ${start+1}–${end} of ${data.length} records`);

  const rows = data.slice(start,end).map((d,i)=>{
    const hs = healthScore(d.temperature,d.humidity,d.air_quality);
    const ac = d.air_quality<1000?"td-clean":d.air_quality<2000?"td-moderate":"td-poor";
    return `<tr>
      <td class="td-time">${start+i+1}</td>
      <td class="td-time">${fmtTime(d.created_at)}</td>
      <td class="td-temp">${s1(d.temperature)} °C</td>
      <td class="td-hum">${s1(d.humidity)} %</td>
      <td class="${ac}">${d.air_quality} ${aqiBadge(d.air_quality)}</td>
      <td style="color:${hColor(hs)};font-weight:600">${hs}</td>
    </tr>`;
  }).join("");

  box.innerHTML = `<div class="table-scroll"><table class="data-table">
    <thead><tr><th>#</th><th>Time</th><th>Temperature</th><th>Humidity</th><th>Air Quality</th><th>Health Score</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;

  /* Pagination */
  const R=5, h=Math.floor(R/2);
  let ps=Math.max(1,currentPage-h), pe=Math.min(total,ps+R-1);
  if(pe-ps<R-1) ps=Math.max(1,pe-R+1);
  let pg=`<button class="pg-btn" onclick="goPage(${currentPage-1})" ${currentPage<=1?"disabled":""}>&#8592; Prev</button>`;
  if(ps>1){ pg+=`<button class="pg-btn" onclick="goPage(1)">1</button>`; if(ps>2) pg+=`<span class="pg-info">…</span>`; }
  for(let p=ps;p<=pe;p++) pg+=`<button class="pg-btn${p===currentPage?" active":""}" onclick="goPage(${p})">${p}</button>`;
  if(pe<total){ if(pe<total-1) pg+=`<span class="pg-info">…</span>`; pg+=`<button class="pg-btn" onclick="goPage(${total})">${total}</button>`; }
  pg+=`<button class="pg-btn" onclick="goPage(${currentPage+1})" ${currentPage>=total?"disabled":""}>Next &#8594;</button>`;
  pg+=`<span class="pg-info">Page ${currentPage} of ${total}</span>`;
  pgEl.innerHTML = pg;
}

window.goPage = function(p) {
  const t = Math.ceil(allData.length/ROWS_PER_PAGE);
  if(p<1||p>t) return;
  currentPage=p; renderTable(allData);
  document.querySelector(".table-panel")?.scrollIntoView({behavior:"smooth",block:"start"});
};

/* ================================================================
   LOAD DATE — main entry point
   Fetches ALL records, filters to selected date client-side.
   silent=true skips the loading spinner (used by auto-refresh).
================================================================ */
async function loadDate(dateStr, silent=false) {
  selectedDate = dateStr;
  currentPage  = 1;

  if (!silent) {
    document.getElementById("tableContainer").innerHTML =
      `<div class="state-box"><div class="spinner"></div>Fetching ALL records for ${fmtLong(dateStr)}…
       <div class="state-sub">Collecting every entry from the database — please wait.</div></div>`;
    document.getElementById("pagination").innerHTML = "";
    setEl("recordCount","Fetching…");
  }

  try {
    /* Fetch ALL records from the database */
    const all = await fetchAllRecords();
    console.log(`[ENVCORE] Total records fetched: ${all.length}`);

    /* Filter to the selected date in LOCAL timezone */
    const data = all
      .filter(d => localDate(d.created_at) === dateStr)
      .sort((a,b) => new Date(a.created_at)-new Date(b.created_at));

    console.log(`[ENVCORE] Records for ${dateStr}: ${data.length}`);

    allData = data;
    setEl("recordCount", data.length+" records");
    updateSummary(data);
    updateCharts(data);
    renderTable(data);

  } catch(err) {
    document.getElementById("tableContainer").innerHTML =
      `<div class="state-box"><span class="state-icon">⚠</span>Backend unreachable.
       <div class="state-sub">${err.message}</div></div>`;
    setEl("recordCount","Error");
    console.error("[ENVCORE] loadDate error:", err);
  }
}

/* ================================================================
   AUTO-REFRESH every 30 s — silent reload so today updates live
================================================================ */
function startRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => loadDate(selectedDate, true), 30000);
}

/* ================================================================
   CSV EXPORT
================================================================ */
document.getElementById("csvBtn")?.addEventListener("click", () => {
  if (!allData.length) { alert("No data for this date."); return; }
  const fname = `sensor-data-${dayName(selectedDate)}-${selectedDate}.csv`;
  let csv = "Time,Temperature (°C),Humidity (%),Air Quality,Health Score,AQI Status\n";
  allData.forEach(d => {
    const hs=healthScore(d.temperature,d.humidity,d.air_quality);
    const st=d.air_quality<1000?"Clean":d.air_quality<2000?"Moderate":"Poor";
    csv+=`${fmtTime(d.created_at)},${d.temperature},${d.humidity},${d.air_quality},${hs},${st}\n`;
  });
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download=`exports/${fname}`; document.body.appendChild(a); a.click();
  document.body.removeChild(a);
});

/* ================================================================
   DATE PICKER & QUICK BUTTONS
================================================================ */
const picker = document.getElementById("datePicker");
if (picker) {
  picker.value = todayStr();
  picker.max   = todayStr();
  picker.addEventListener("change", () => {
    document.querySelectorAll(".qd-btn").forEach(b=>b.classList.remove("active"));
    loadDate(picker.value); startRefresh();
  });
}

document.querySelectorAll(".qd-btn").forEach(btn => {
  btn.addEventListener("click", function() {
    document.querySelectorAll(".qd-btn").forEach(b=>b.classList.remove("active"));
    this.classList.add("active");
    const d=new Date(); d.setDate(d.getDate()-parseInt(this.dataset.offset,10));
    const str=`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
    if (picker) picker.value=str;
    loadDate(str); startRefresh();
  });
});

/* ================================================================
   CLOCK
================================================================ */
(function tick(){ const e=document.getElementById("clockDisplay"); if(e) e.textContent=new Date().toLocaleTimeString("en-GB"); setTimeout(tick,1000); })();

/* ================================================================
   THEME
================================================================ */
document.getElementById("themeToggle")?.addEventListener("click",function(){
  const dark=document.documentElement.getAttribute("data-theme")==="dark";
  document.documentElement.setAttribute("data-theme",dark?"light":"dark");
  this.classList.toggle("light-mode",dark);
});

/* ================================================================
   PARTICLE BACKGROUND
================================================================ */
(function bg(){
  const cv=document.getElementById("bgCanvas"); if(!cv) return;
  const c=cv.getContext("2d"); let W,H;
  function resize(){W=cv.width=innerWidth;H=cv.height=innerHeight;}
  resize(); window.addEventListener("resize",resize);
  const DOTS=Array.from({length:55},()=>({x:Math.random()*1920,y:Math.random()*1080,vx:(Math.random()-.5)*.16,vy:(Math.random()-.5)*.16,r:Math.random()*1.3+.35,a:Math.random()*.38+.14}));
  let hp=0;
  function hexGrid(){hp+=.004;const gs=72,cols=Math.ceil(W/(gs*1.5))+2,rows=Math.ceil(H/(gs*.866))+2;c.save();c.globalAlpha=.016+Math.sin(hp)*.005;c.strokeStyle="#00e5ff";c.lineWidth=.5;for(let col=-1;col<cols;col++)for(let row=-1;row<rows;row++){const cx=col*gs*1.5,cy=row*gs*.866+(col%2?gs*.433:0);c.beginPath();for(let i=0;i<6;i++){const ang=i/6*6.28-Math.PI/6;const px=cx+Math.cos(ang)*gs*.47,py=cy+Math.sin(ang)*gs*.47;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.stroke();}c.restore();}
  (function draw(){c.clearRect(0,0,W,H);const light=document.documentElement.getAttribute("data-theme")==="light";if(!light)hexGrid();DOTS.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;c.beginPath();c.arc(p.x,p.y,p.r,0,6.28);c.fillStyle=light?`rgba(0,80,180,${p.a*.2})`:`rgba(0,229,255,${p.a*.22})`;c.fill();});for(let i=0;i<DOTS.length;i++)for(let j=i+1;j<DOTS.length;j++){const dx=DOTS[i].x-DOTS[j].x,dy=DOTS[i].y-DOTS[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<125){c.beginPath();c.moveTo(DOTS[i].x,DOTS[i].y);c.lineTo(DOTS[j].x,DOTS[j].y);c.strokeStyle=light?`rgba(0,80,180,${.045*(1-d/125)})`:`rgba(0,229,255,${.045*(1-d/125)})`;c.lineWidth=.5;c.stroke();}}requestAnimationFrame(draw);})();
})();

/* ================================================================
   BOOT
================================================================ */
loadDate(todayStr());
startRefresh();