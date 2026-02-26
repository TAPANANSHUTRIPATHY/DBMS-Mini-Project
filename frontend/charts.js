/* ================================================================
   charts.js  — ENVCORE UI Layer
   Loads after script.js.
   script.js owns: tempHumChart, airChart, tempGauge, airGauge
   charts.js owns: humLineChart, humGauge, healthRing, modals,
                   sparklines, background, theme, clock, alerts
================================================================ */
(function () {
  "use strict";

  const FONT  = "Rajdhani";
  const TICK  = "rgba(200,232,255,0.72)";
  const GRID  = "rgba(255,255,255,0.06)";
  const RED   = "rgb(255,77,77)";
  const CYAN  = "rgb(0,229,255)";
  const GREEN = "rgb(0,255,136)";

  // Realistic Y ranges per metric
  const YR = {
    temp: { min: -10, max: 60,   stepSize: 5   },
    hum:  { min: 0,   max: 100,  stepSize: 5   },
    aqi:  { min: 0,   max: 3000, stepSize: 250  },
  };

  function toRgba(rgb, a) {
    return rgb.replace("rgb(", "rgba(").replace(")", `,${a})`);
  }
  function getCtx(id) {
    const el = document.getElementById(id);
    return el ? el.getContext("2d") : null;
  }

  /* ── standard line chart config with proper axis density ── */
  function lineOpts(label, color, yr) {
    return {
      type: "line",
      data: { labels: [], datasets: [{
        label, borderColor: color, backgroundColor: toRgba(color, 0.12),
        data: [], tension: 0.4, pointRadius: 2.5, pointHoverRadius: 7,
        pointBackgroundColor: color, fill: true, borderWidth: 2,
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 500 },
        plugins: {
          legend: { labels: { color: TICK, font: { family: FONT, size: 13 }, boxWidth: 26, padding: 12 }},
          tooltip: {
            mode: "index", intersect: false,
            backgroundColor: "rgba(6,16,30,0.93)", borderColor: color, borderWidth: 1,
            titleColor: TICK, bodyColor: "#fff",
            titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12,
          },
        },
        scales: {
          x: {
            ticks: { color: TICK, maxTicksLimit: 16, maxRotation: 45, font: { family: FONT, size: 10 }},
            grid:  { color: GRID },
          },
          y: {
            min: yr.min, max: yr.max,
            ticks: { color: TICK, stepSize: yr.stepSize, maxTicksLimit: 18, font: { family: FONT, size: 10 }},
            grid: { color: GRID },
          },
        },
      },
    };
  }

  function sparkOpts(color) {
    return {
      type: "line",
      data: { labels: [], datasets: [{
        data: [], borderColor: color, backgroundColor: toRgba(color, 0.1),
        borderWidth: 1.5, pointRadius: 0, fill: true, tension: 0.4,
      }]},
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }},
        scales: { x: { display: false }, y: { display: false }},
      },
    };
  }

  /* ── Init charts.js-owned charts ── */
  const humLineChart   = getCtx("humLineChart")    ? new Chart(getCtx("humLineChart"),    lineOpts("Humidity (%)",     CYAN,  YR.hum))  : null;
  const tempLargeChart = getCtx("tempLargeCanvas") ? new Chart(getCtx("tempLargeCanvas"), lineOpts("Temperature (°C)", RED,   YR.temp)) : null;
  const humLargeChart  = getCtx("humLargeCanvas")  ? new Chart(getCtx("humLargeCanvas"),  lineOpts("Humidity (%)",     CYAN,  YR.hum))  : null;
  const airLargeChart  = getCtx("airLargeCanvas")  ? new Chart(getCtx("airLargeCanvas"),  lineOpts("Air Quality",      GREEN, YR.aqi))  : null;

  const humGauge = getCtx("humGauge") ? new Chart(getCtx("humGauge"), {
    type: "doughnut",
    data: { datasets: [{ data:[0,100], backgroundColor:["#00e5ff","#1e293b"], borderWidth:0 }]},
    options: { rotation:-90, circumference:180, cutout:"75%", animation:false, plugins:{legend:{display:false}}},
  }) : null;

  const healthChart = getCtx("healthRing") ? new Chart(getCtx("healthRing"), {
    type: "doughnut",
    data: { datasets: [{
      data: [33,33,34],
      backgroundColor:["rgba(255,77,77,0.15)","rgba(0,229,255,0.15)","rgba(0,255,136,0.15)"],
      borderColor:    ["rgba(255,77,77,0.7)", "rgba(0,229,255,0.7)", "rgba(0,255,136,0.7)"],
      borderWidth: 2,
    }]},
    options: { cutout:"75%", plugins:{legend:{display:false},tooltip:{enabled:false}}, animation:{duration:900}},
  }) : null;

  const tempSpk = getCtx("tempSparkline") ? new Chart(getCtx("tempSparkline"), sparkOpts(RED))   : null;
  const humSpk  = getCtx("humSparkline")  ? new Chart(getCtx("humSparkline"),  sparkOpts(CYAN))  : null;
  const airSpk  = getCtx("airSparkline")  ? new Chart(getCtx("airSparkline"),  sparkOpts(GREEN)) : null;

  /* ── Patch script.js charts axis options (once) ── */
  function patchScriptCharts() {
    const all = Object.values(Chart.instances);
    const mc  = all.find(c => c.canvas?.id === "tempHumChart");
    const ac  = all.find(c => c.canvas?.id === "airChart");

    function ax(chart, yr, color) {
      if (!chart) return;
      Object.assign(chart.options.scales.x.ticks, { color:TICK, maxTicksLimit:16, maxRotation:45, font:{family:FONT,size:10}});
      chart.options.scales.x.grid = { color: GRID };
      Object.assign(chart.options.scales.y, {
        min: yr.min, max: yr.max,
        ticks: { color:TICK, stepSize:yr.stepSize, maxTicksLimit:18, font:{family:FONT,size:10}},
        grid: { color: GRID },
      });
      chart.options.plugins.tooltip = {
        mode:"index", intersect:false, backgroundColor:"rgba(6,16,30,0.93)",
        borderColor:color, borderWidth:1, titleColor:TICK, bodyColor:"#fff",
        titleFont:{family:FONT,size:12}, bodyFont:{family:FONT,size:13}, padding:12,
      };
    }
    ax(mc, YR.temp, RED);
    ax(ac, YR.aqi,  GREEN);
    if(mc) mc.update("none");
    if(ac) ac.update("none");
  }
  setTimeout(patchScriptCharts, 800);

  /* ================================================================
     ANIMATED BACKGROUND
     Layer 1: hex grid (very subtle)
     Layer 2: floating env symbols — drops, thermometers, rings, hexes
     Layer 3: network particle mesh
  ================================================================ */
  (function animBg() {
    const cv = document.getElementById("bgCanvas");
    if (!cv) return;
    const bx = cv.getContext("2d");
    let W, H;
    function resize(){ W = cv.width = innerWidth; H = cv.height = innerHeight; }
    resize(); window.addEventListener("resize", resize);

    /* network dots */
    const DOTS = Array.from({length:65}, () => ({
      x:Math.random()*1920, y:Math.random()*1080,
      vx:(Math.random()-.5)*.18, vy:(Math.random()-.5)*.18,
      r:Math.random()*1.3+.35, a:Math.random()*.4+.15,
    }));

    /* env symbols */
    const TYPES = ["drop","drop","drop","therm","ring","ring","hex","dot"];
    function newSym() {
      return {
        t: TYPES[Math.floor(Math.random()*TYPES.length)],
        x: Math.random()*1920,
        y: H + 50 + Math.random()*200,
        vx:(Math.random()-.5)*.1,
        vy:-(Math.random()*.3+.08),
        sz: Math.random()*13+5,
        life: 0,
        maxLife: Math.random()*700+250,
        hue: [180,190,160,200,130][Math.floor(Math.random()*5)],
        rot: Math.random()*6.28,
        rv: (Math.random()-.5)*.007,
      };
    }
    const SYMS = Array.from({length:40}, () => {
      const s = newSym();
      s.y = Math.random()*H; s.life = Math.random()*s.maxLife;
      return s;
    });

    function drawDrop(x,y,sz,a,hue){
      bx.save(); bx.translate(x,y); bx.globalAlpha=a;
      bx.strokeStyle=`hsl(${hue},90%,65%)`; bx.lineWidth=.9;
      bx.shadowColor=`hsl(${hue},90%,65%)`; bx.shadowBlur=7;
      bx.beginPath();
      bx.moveTo(0,-sz);
      bx.bezierCurveTo(sz*.85,-sz*.15,sz*.85,sz*.5,0,sz*.82);
      bx.bezierCurveTo(-sz*.85,sz*.5,-sz*.85,-sz*.15,0,-sz);
      bx.stroke(); bx.restore();
    }
    function drawTherm(x,y,sz,a){
      bx.save(); bx.translate(x,y); bx.globalAlpha=a;
      bx.strokeStyle=`rgba(255,110,80,${a})`; bx.lineWidth=1.1;
      bx.shadowColor="#ff4d4d"; bx.shadowBlur=6;
      // stem rectangle
      bx.beginPath();
      bx.moveTo(-sz*.17,-sz); bx.lineTo(sz*.17,-sz);
      bx.lineTo(sz*.17,sz*.35); bx.lineTo(-sz*.17,sz*.35); bx.closePath(); bx.stroke();
      // bulb
      bx.beginPath(); bx.arc(0,sz*.5,sz*.3,0,6.28);
      bx.fillStyle=`rgba(255,77,77,${a*.55})`; bx.fill(); bx.restore();
    }
    function drawRing(x,y,sz,a,hue){
      bx.save(); bx.translate(x,y); bx.globalAlpha=a;
      bx.strokeStyle=`hsl(${hue},90%,60%)`; bx.lineWidth=.8;
      bx.shadowColor=`hsl(${hue},90%,60%)`; bx.shadowBlur=9;
      bx.beginPath(); bx.arc(0,0,sz,0,6.28); bx.stroke();
      bx.globalAlpha=a*.4; bx.beginPath(); bx.arc(0,0,sz*.5,0,6.28); bx.stroke();
      for(let i=0;i<6;i++){
        const ang=i/6*6.28;
        bx.globalAlpha=a*.6; bx.beginPath();
        bx.arc(Math.cos(ang)*sz,Math.sin(ang)*sz,sz*.1,0,6.28);
        bx.fillStyle=`hsl(${hue},90%,70%)`; bx.fill();
      }
      bx.restore();
    }
    function drawHex(x,y,sz,a){
      bx.save(); bx.translate(x,y); bx.globalAlpha=a*.3;
      bx.strokeStyle="rgba(0,229,255,1)"; bx.lineWidth=.6;
      bx.beginPath();
      for(let i=0;i<6;i++){
        const ang=i/6*6.28-Math.PI/6;
        i?bx.lineTo(Math.cos(ang)*sz,Math.sin(ang)*sz)
         :bx.moveTo(Math.cos(ang)*sz,Math.sin(ang)*sz);
      }
      bx.closePath(); bx.stroke(); bx.restore();
    }
    function drawDot(x,y,sz,a,hue){
      bx.save(); bx.globalAlpha=a;
      bx.beginPath(); bx.arc(x,y,sz*.22,0,6.28);
      bx.fillStyle=`hsl(${hue},90%,65%)`;
      bx.shadowColor=`hsl(${hue},90%,65%)`; bx.shadowBlur=sz*1.6; bx.fill(); bx.restore();
    }

    /* hex grid */
    let hp=0;
    function hexGrid(){
      hp+=.004;
      const gs=72;
      const cols=Math.ceil(W/(gs*1.5))+2, rows=Math.ceil(H/(gs*.866))+2;
      bx.save(); bx.globalAlpha=.016+Math.sin(hp)*.005;
      bx.strokeStyle="#00e5ff"; bx.lineWidth=.5;
      for(let col=-1;col<cols;col++){
        for(let row=-1;row<rows;row++){
          const cx=col*gs*1.5, cy=row*gs*.866+(col%2?gs*.433:0);
          bx.beginPath();
          for(let i=0;i<6;i++){
            const ang=i/6*6.28-Math.PI/6;
            const px=cx+Math.cos(ang)*gs*.47, py=cy+Math.sin(ang)*gs*.47;
            i?bx.lineTo(px,py):bx.moveTo(px,py);
          }
          bx.closePath(); bx.stroke();
        }
      }
      bx.restore();
    }

    (function draw(){
      bx.clearRect(0,0,W,H);
      const light=document.documentElement.getAttribute("data-theme")==="light";

      if(!light) hexGrid();

      /* network mesh */
      DOTS.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<0)p.x=W; if(p.x>W)p.x=0; if(p.y<0)p.y=H; if(p.y>H)p.y=0;
        bx.beginPath(); bx.arc(p.x,p.y,p.r,0,6.28);
        bx.fillStyle=light?`rgba(0,80,180,${p.a*.2})`:`rgba(0,229,255,${p.a*.25})`; bx.fill();
      });
      for(let i=0;i<DOTS.length;i++) for(let j=i+1;j<DOTS.length;j++){
        const dx=DOTS[i].x-DOTS[j].x, dy=DOTS[i].y-DOTS[j].y, d=Math.sqrt(dx*dx+dy*dy);
        if(d<125){
          bx.beginPath(); bx.moveTo(DOTS[i].x,DOTS[i].y); bx.lineTo(DOTS[j].x,DOTS[j].y);
          bx.strokeStyle=light?`rgba(0,80,180,${.05*(1-d/125)})`:`rgba(0,229,255,${.05*(1-d/125)})`;
          bx.lineWidth=.5; bx.stroke();
        }
      }

      /* env symbols — dark only */
      if(!light) SYMS.forEach(s=>{
        s.x+=s.vx; s.y+=s.vy; s.rot+=s.rv; s.life++;
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

  /* ================================================================ CLOCK ================================================================ */
  (function tick(){
    const el=document.getElementById("clockDisplay");
    if(el) el.textContent=new Date().toLocaleTimeString("en-GB");
    setTimeout(tick,1000);
  })();

  /* ================================================================ GEOLOCATION ================================================================ */
  (function geo(){
    const disp=document.getElementById("locationDisplay");
    const icon=document.getElementById("locationIcon");
    if(!disp) return;
    disp.textContent="Locating…";
    if(icon) icon.classList.add("pinging");
    navigator.geolocation?.getCurrentPosition(
      pos => fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
        .then(r=>r.json()).then(d=>{
          const parts=[d.address?.city||d.address?.town||d.address?.village,d.address?.state,d.address?.country].filter(Boolean);
          disp.textContent=parts.join(", ")||"Unknown";
          if(icon){icon.classList.remove("pinging");icon.classList.add("located");}
        }).catch(()=>{disp.textContent="Unavailable";if(icon)icon.classList.remove("pinging");}),
      ()=>{disp.textContent="Unavailable";if(icon)icon.classList.remove("pinging");}
    );
  })();

  /* ================================================================ THEME ================================================================ */
  document.getElementById("themeToggle")?.addEventListener("click", function(){
    const dark=document.documentElement.getAttribute("data-theme")==="dark";
    document.documentElement.setAttribute("data-theme",dark?"light":"dark");
    this.classList.toggle("light-mode",dark);
  });

  /* ================================================================ MODALS ================================================================ */
  window.openModal=function(id){
    const el=document.getElementById(id);if(!el)return;
    el.style.display="flex";
    setTimeout(()=>{
      if(id==="tempModal"&&tempLargeChart)tempLargeChart.resize();
      if(id==="humModal" &&humLargeChart) humLargeChart.resize();
      if(id==="airModal" &&airLargeChart) airLargeChart.resize();
    },60);
  };
  window.closeModal=function(id){const el=document.getElementById(id);if(el)el.style.display="none";};

  /* ================================================================ ALERTS ================================================================ */
  let lastAlertTs=0;
  function checkAlerts(temp,hum,aqi){
    if(Date.now()-lastAlertTs<12000)return;
    const msgs=[];
    if(temp>35) msgs.push(`🌡 Temperature critical: ${temp}°C`);
    if(temp<5)  msgs.push(`🌡 Temperature very low: ${temp}°C`);
    if(hum>85)  msgs.push(`💧 Humidity very high: ${hum}%`);
    if(hum<20)  msgs.push(`💧 Humidity very low: ${hum}%`);
    if(aqi>2000)msgs.push(`🌫 Air quality POOR: AQI ${aqi}`);
    else if(aqi>1000)msgs.push(`🌫 Air quality MODERATE: AQI ${aqi}`);
    if(!msgs.length)return;
    const b=document.getElementById("alertBanner"),t=document.getElementById("alertText");
    if(b&&t){t.textContent=msgs[0];b.classList.remove("hidden");lastAlertTs=Date.now();}
  }

  /* ================================================================ HELPERS ================================================================ */
  function setEl(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
  function statsOf(arr){
    if(!arr.length)return{min:"--",max:"--",avg:"--"};
    return{min:Math.min(...arr).toFixed(1),max:Math.max(...arr).toFixed(1),avg:(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1)};
  }
  function mirrorData(chart,labels,data){
    if(!chart||!labels.length)return;
    chart.data.labels=labels;
    if(chart.data.datasets.length)chart.data.datasets[0].data=data;
    chart.update("none");
  }

  /* ================================================================ HEALTH RING ================================================================ */
  function updateHealth(temp,hum,aqi){
    const ts=Math.max(0,100-Math.abs(temp-22)*4);
    const hs=Math.max(0,100-Math.abs(hum-50)*2);
    const as=Math.max(0,100-(aqi/3000)*100);
    const score=Math.round((ts+hs+as)/3);
    setEl("healthScore",score);
    let grade="--",col="#00e5ff";
    if(score>=80){grade="EXCELLENT";col="#00ff88";}
    else if(score>=60){grade="GOOD";col="#00e5ff";}
    else if(score>=40){grade="MODERATE";col="#ffcc00";}
    else{grade="POOR";col="#ff4d4d";}
    const g=document.getElementById("healthGrade");
    if(g){g.textContent=grade;g.style.color=col;}
    if(healthChart){
      healthChart.data.datasets[0].data=[ts,hs,as];
      healthChart.data.datasets[0].borderColor=[`rgba(255,77,77,${.4+ts/200})`,`rgba(0,229,255,${.4+hs/200})`,`rgba(0,255,136,${.4+as/200})`];
      healthChart.data.datasets[0].backgroundColor=[`rgba(255,77,77,${.06+ts/400})`,`rgba(0,229,255,${.06+hs/400})`,`rgba(0,255,136,${.06+as/400})`];
      healthChart.update("none");
    }
    setEl("hlTemp",Math.round(ts));setEl("hlHum",Math.round(hs));setEl("hlAqi",Math.round(as));
  }

  /* ================================================================ CARD BG + BARS ================================================================ */
  function updateCardBg(temp,hum,aqi){
    const th=Math.round(220-Math.min(Math.max(temp,0),50)/50*220);
    const tb=document.querySelector(".temp-bg");
    if(tb)tb.style.background=`radial-gradient(circle at 30% 50%,hsla(${th},100%,55%,.18),transparent 70%)`;
    const hh=Math.round(30+Math.min(Math.max(hum,0),100)/100*170);
    const hb=document.querySelector(".hum-bg");
    if(hb)hb.style.background=`radial-gradient(circle at 70% 40%,hsla(${hh},100%,55%,.18),transparent 70%)`;
    const tbar=document.getElementById("tempBar"),hbar=document.getElementById("humBar"),abar=document.getElementById("airBar");
    if(tbar)tbar.style.width=`${Math.min(Math.max((temp+10)/70*100,0),100)}%`;
    if(hbar)hbar.style.width=`${Math.min(Math.max(hum,0),100)}%`;
    if(abar)abar.style.width=`${Math.min(aqi/3000*100,100)}%`;
  }

  /* ================================================================ LOCAL HISTORY ================================================================ */
  const LH={temp:[],hum:[],aqi:[],labels:[]};
  let LK={temp:null,hum:null,aqi:null};

  function onValueChange(){
    const temp=parseFloat(document.getElementById("temp")?.textContent);
    const hum=parseFloat(document.getElementById("hum")?.textContent);
    const aqi=parseFloat(document.getElementById("air")?.textContent);
    if(isNaN(temp)||isNaN(hum)||isNaN(aqi))return;
    if(temp===LK.temp&&hum===LK.hum&&aqi===LK.aqi)return;
    LK={temp,hum,aqi};
    updateHealth(temp,hum,aqi);updateCardBg(temp,hum,aqi);checkAlerts(temp,hum,aqi);
    if(LH.labels.length>=40){LH.temp.shift();LH.hum.shift();LH.aqi.shift();LH.labels.shift();}
    LH.temp.push(temp);LH.hum.push(hum);LH.aqi.push(aqi);LH.labels.push(new Date().toLocaleTimeString("en-GB"));
    [[tempSpk,LH.temp],[humSpk,LH.hum],[airSpk,LH.aqi]].forEach(([s,d])=>{if(!s)return;s.data.labels=LH.labels;s.data.datasets[0].data=d;s.update("none");});
    const ts=statsOf(LH.temp),hs=statsOf(LH.hum),as=statsOf(LH.aqi);
    ["Min","Avg","Max"].forEach((k,i)=>{
      setEl("temp"+k,[ts.min,ts.avg,ts.max][i]);
      setEl("hum" +k,[hs.min,hs.avg,hs.max][i]);
      setEl("air" +k,[as.min,as.avg,as.max][i]);
      setEl("tTemp"+k,[ts.min,ts.avg,ts.max][i]);
      setEl("tHum" +k,[hs.min,hs.avg,hs.max][i]);
      setEl("tAqi" +k,[as.min,as.avg,as.max][i]);
    });
  }
  ["temp","hum","air"].forEach(id=>{
    const el=document.getElementById(id);
    if(el)new MutationObserver(onValueChange).observe(el,{childList:true,characterData:true,subtree:true});
  });

  /* ================================================================
     MAIN SYNC
     Runs at 3200ms — 200ms AFTER script.js finishes fetchHistory().
     script.js writes datasets[0]=temp, datasets[1]=hum every 3000ms.
     We grab humidity BEFORE stripping, cache it, push to humLineChart.
  ================================================================ */
  let cachedHumData=[], cachedHumLabels=[];

  function sync(){
    const all=Object.values(Chart.instances);
    const mc=all.find(c=>c.canvas?.id==="tempHumChart");
    const ac=all.find(c=>c.canvas?.id==="airChart");

    if(mc&&mc.data.labels.length>0){
      const labels=mc.data.labels;
      const ds0=mc.data.datasets[0]; // Temperature
      const ds1=mc.data.datasets[1]; // Humidity — exists right after fetchHistory
      const tempData=ds0?ds0.data.slice():[];

      // Save humidity BEFORE stripping
      if(ds1&&ds1.data.length>0){
        cachedHumData=ds1.data.slice();
        cachedHumLabels=labels.slice();
      }

      // Strip humidity from temp tile every cycle
      if(mc.data.datasets.length>1) mc.data.datasets=[mc.data.datasets[0]];

      // Reapply axis range each cycle (script.js .update() resets it)
      mc.options.scales.y.min=YR.temp.min;
      mc.options.scales.y.max=YR.temp.max;
      if(mc.options.scales.y.ticks) mc.options.scales.y.ticks.stepSize=YR.temp.stepSize;
      mc.update("none");

      // Push humidity data to humidity tile
      if(humLineChart&&cachedHumData.length>0){
        humLineChart.data.labels=cachedHumLabels;
        humLineChart.data.datasets[0].data=cachedHumData;
        humLineChart.update("none");
      }

      // Humidity gauge
      const lh=cachedHumData[cachedHumData.length-1];
      if(humGauge&&lh!=null&&!isNaN(lh)){
        humGauge.data.datasets[0].data=[lh,Math.max(0,100-lh)];
        humGauge.update("none");
        setEl("humGaugeValue",lh.toFixed(1)+" %");
      }

      mirrorData(tempLargeChart,labels,tempData);
      mirrorData(humLargeChart,cachedHumLabels,cachedHumData);
    }

    if(ac&&ac.data.labels.length>0){
      ac.options.scales.y.min=YR.aqi.min;
      ac.options.scales.y.max=YR.aqi.max;
      if(ac.options.scales.y.ticks) ac.options.scales.y.ticks.stepSize=YR.aqi.stepSize;
      ac.update("none");
      mirrorData(airLargeChart,ac.data.labels,ac.data.datasets[0]?.data||[]);
    }
  }

  setTimeout(sync,600);
  setInterval(sync,3200);

})();