// forecast.js — handles the "Today's Master Graph" and "7-Day Trend" charts
// all data comes from our own backend (same Supabase DB the ESP32 writes to)
// no Open-Meteo or dummy data here — if backend is down, charts stay empty

// this whole module is wrapped in an IIFE (immediately invoked function expression)
// so its variables don't pollute the global scope and conflict with script.js
(function () {
  "use strict";

  const FONT = "Rajdhani";
  const TICK = "rgba(200,232,255,0.72)";
  const GRID = "rgba(255,255,255,0.06)";

  const COLORS = {
    temp: "rgb(255,77,77)",
    hum: "rgb(0,229,255)",
    aqi: "rgb(0,255,136)"
  };

  // helper to make a color semi-transparent by converting rgb( to rgba(
  function rgba(c, a) {
    return c.replace("rgb(", "rgba(").replace(")", `,${a})`);
  }

  function ctx(id) {
    const e = document.getElementById(id);
    return e ? e.getContext("2d") : null;
  }

  function setEl(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7-DAY LABELS — builds an array like ["Mon 24 Mar", "Tue 25 Mar", ... "Sun 30 Mar"]
  // index 0 = 6 days ago (oldest), index 6 = today (newest)
  // ─────────────────────────────────────────────────────────────────────────────
  function make7DayLabels() {
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));   // 6-i so index 0 is 6 days ago, index 6 is today
      return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    });
  }
  const WEEK_LABELS = make7DayLabels();

  // ─────────────────────────────────────────────────────────────────────────────
  // TILE CHART — single metric line chart for the 7-day trend view
  // uses a fixed 7-slot axis (one slot per day), null values show as line breaks
  // ─────────────────────────────────────────────────────────────────────────────
  function makeTileChart(canvasId, label, color) {
    const c = ctx(canvasId);
    if (!c) return null;
    return new Chart(c, {
      type: "line",
      data: {
        labels: WEEK_LABELS,
        datasets: [{
          label, borderColor: color,
          backgroundColor: rgba(color, 0.14),
          data: new Array(7).fill(null),   // start with all nulls, will be filled after fetch
          tension: 0.4,
          pointRadius: 5, pointHoverRadius: 8,
          pointBackgroundColor: color,
          fill: true,
          borderWidth: 2.5,
          spanGaps: false   // null means "no data that day" → show a break in the line
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 600, easing: "easeOutQuart" },
        plugins: {
          legend: { display: false },  // tile charts are small — no legend needed
          tooltip: {
            mode: "index", intersect: false, backgroundColor: "rgba(6,16,30,0.93)",
            borderColor: color, borderWidth: 1, titleColor: TICK, bodyColor: "#fff",
            titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12,
            callbacks: {
              // suppress null tooltip labels (no data that day)
              label: ctx => ctx.parsed.y === null ? null : `${label}: ${ctx.parsed.y.toFixed(1)}`
            }
          }
        },
        scales: {
          x: { ticks: { color: TICK, font: { family: FONT, size: 10 } }, grid: { color: GRID } },
          y: { ticks: { color: color, maxTicksLimit: 6, font: { family: FONT, size: 10 } }, grid: { color: GRID } }
        }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MASTER CHART — today's data bucketed by 30-min slots
  // 48 slots total (00:00, 00:30, … 23:30), null = no reading in that half-hour
  // has 3 separate Y axes for temp/humidity/AQI so they can scale independently
  // ─────────────────────────────────────────────────────────────────────────────
  const MASTER_HOURS = Array.from({ length: 48 }, (_, i) => {
    const h = Math.floor(i / 2);
    const m = i % 2 === 0 ? "00" : "30";
    return `${String(h).padStart(2, "0")}:${m}`;
  });

  function makeMasterChart(canvasId) {
    const c = ctx(canvasId);
    if (!c) return null;
    return new Chart(c, {
      type: "line",
      data: {
        labels: MASTER_HOURS,  // always 48 labels, data is null for slots with no readings
        datasets: [
          {
            label: "Temperature (°C)", borderColor: COLORS.temp,
            backgroundColor: rgba(COLORS.temp, 0.08),
            data: new Array(48).fill(null),
            tension: 0.4, pointRadius: 2, pointHoverRadius: 5,
            borderWidth: 2.5, yAxisID: "y", fill: false,
            spanGaps: false  // gaps in data show as line breaks — more honest than interpolation
          },
          {
            label: "Humidity (%)", borderColor: COLORS.hum,
            backgroundColor: rgba(COLORS.hum, 0.08),
            data: new Array(48).fill(null),
            tension: 0.4, pointRadius: 2, pointHoverRadius: 5,
            borderWidth: 2.5, yAxisID: "y1", fill: false,
            spanGaps: false
          },
          {
            label: "Air Quality Index", borderColor: COLORS.aqi,
            backgroundColor: rgba(COLORS.aqi, 0.08),
            data: new Array(48).fill(null),
            tension: 0.4, pointRadius: 2, pointHoverRadius: 5,
            borderWidth: 2.5, yAxisID: "y2", fill: false,
            spanGaps: false
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: false,  // instant render — no delay when data comes in
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: { color: TICK, font: { family: FONT, size: 12 }, boxWidth: 20, padding: 16 }
          },
          tooltip: {
            backgroundColor: "rgba(6,16,30,0.93)",
            titleColor: TICK, bodyColor: "#fff",
            titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12,
            callbacks: {
              label: ctx => ctx.parsed.y === null ? null : `${ctx.dataset.label}: ${ctx.parsed.y}`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: TICK, font: { family: FONT, size: 10 }, maxTicksLimit: 48, maxRotation: 45 },
            grid: { color: GRID }
          },
          y: {  // temperature — left axis
            type: "linear", position: "left",
            grace: "15%",
            ticks: { color: COLORS.temp, font: { family: FONT, size: 10 } },
            grid: { color: GRID },
            title: { display: true, text: "Temp (°C)", color: COLORS.temp, font: { family: FONT, size: 10 } }
          },
          y1: {  // humidity — right axis
            type: "linear", position: "right",
            grace: "15%",
            ticks: { color: COLORS.hum, font: { family: FONT, size: 10 } },
            grid: { drawOnChartArea: false },  // don't draw grid lines for this axis — too cluttered
            title: { display: true, text: "Humidity (%)", color: COLORS.hum, font: { family: FONT, size: 10 } }
          },
          y2: {  // AQI — also right axis, offset from y1
            type: "linear", position: "right",
            grace: "20%",
            ticks: { color: COLORS.aqi, font: { family: FONT, size: 10 } },
            grid: { drawOnChartArea: false },
            title: { display: true, text: "AQI", color: COLORS.aqi, font: { family: FONT, size: 10 } }
          }
        }
      }
    });
  }

  // chart instance references
  let masterChart = null;
  let masterLargeChart = null;   // the fullscreen/modal version of the master chart
  let tempTileChart = null;
  let humTileChart = null;
  let aqiTileChart = null;

  function initCharts() {
    masterChart = makeMasterChart("masterForeChart");
    masterLargeChart = makeMasterChart("masterLargeCanvas");  // same chart, bigger canvas in the modal
    tempTileChart = makeTileChart("foreTempChart", "Temperature (°C)", COLORS.temp);
    humTileChart = makeTileChart("foreHumChart", "Humidity (%)", COLORS.hum);
    aqiTileChart = makeTileChart("foreAqiChart", "Air Quality Index", COLORS.aqi);
  }

  // resets all charts to empty state (all nulls) — called when backend is offline
  function clearAll() {
    // master chart: refill with 48 nulls (keeps the time axis, just no data)
    [masterChart, masterLargeChart].forEach(ch => {
      if (!ch) return;
      ch.data.datasets.forEach(ds => (ds.data = new Array(48).fill(null)));
      ch.update("none");
    });
    // tile charts: refill with 7 nulls (keeps the 7-day axis, no data points)
    [tempTileChart, humTileChart, aqiTileChart].forEach(ch => {
      if (!ch) return;
      ch.data.datasets[0].data = new Array(7).fill(null);
      ch.update("none");
    });
  }

  // pushes new data into a tile chart — data7 is a 7-element array (index 0 = 6 days ago)
  function updateTile(chart, data7) {
    if (!chart) return;
    chart.data.datasets[0].data = data7;
    chart.update("none");
  }

  // pushes data into both the small and large master charts at the same time
  function updateMasterBoth(tempSlots, humSlots, aqiSlots) {
    [masterChart, masterLargeChart].forEach(ch => {
      if (!ch) return;
      ch.data.datasets[0].data = tempSlots;
      ch.data.datasets[1].data = humSlots;
      ch.data.datasets[2].data = aqiSlots;
      ch.update("none");
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN DATA FETCH
  // fetches the full history from the backend and then:
  //   1. buckets today's data into 48 30-min slots for the master chart
  //   2. calculates daily averages for the past 7 days for the tile charts
  // ─────────────────────────────────────────────────────────────────────────────
  let _lastRenderTs = "";  // avoid re-rendering if nothing changed since last fetch

  async function fetchAndRender() {
    const D = window.ENVDATA;
    if (!D || !D.backendOnline) { clearAll(); return; }  // if script.js hasn't gotten data yet, skip

    const API_URL = window._ENVCORE_API_URL || "https://dbms-mini-project-vgp4.onrender.com/api";
    const endpoints = [
      `${API_URL}/history?limit=10000`,
      `${API_URL}/history?all=true`,
      `${API_URL}/history`
    ];

    let raw = null;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;
        const arr = await res.json();
        if (!Array.isArray(arr) || !arr.length) continue;
        raw = arr;
        break;  // stop at the first working endpoint
      } catch (_) { continue; }
    }

    if (!raw) { clearAll(); return; }  // couldn't get data from any endpoint

    // sort by time just in case the DB didn't return them in order
    raw.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const lastTs = raw[raw.length - 1]?.created_at || "";
    if (lastTs === _lastRenderTs) return;   // nothing new since last render, skip
    _lastRenderTs = lastTs;

    const now = new Date();
    const todayStr = now.getFullYear() + "-"
      + String(now.getMonth() + 1).padStart(2, "0") + "-"
      + String(now.getDate()).padStart(2, "0");

    // filter rows that belong to today in local time
    // we compare local date strings because DB timestamps are in UTC (IST = UTC+5:30)
    const todayRows = raw.filter(r => {
      if (!r.created_at) return false;
      const d = new Date(r.created_at);
      const localDate = d.getFullYear() + "-"
        + String(d.getMonth() + 1).padStart(2, "0") + "-"
        + String(d.getDate()).padStart(2, "0");
      return localDate === todayStr;
    });

    // ── Master chart: bucket today's data into 30-min slots ──
    const masterTempSlots = new Array(48).fill(null);
    const masterHumSlots = new Array(48).fill(null);
    const masterAqiSlots = new Array(48).fill(null);

    let lastSlotIndex = -1;  // track the most recent slot with data (for the pulse dot)

    todayRows.forEach(r => {
      const d = new Date(r.created_at);
      // slot number: hours * 2 + (minutes >= 30 ? 1 : 0)
      const slot = (d.getHours() * 2) + Math.floor(d.getMinutes() / 30);
      if (slot > lastSlotIndex) lastSlotIndex = slot;

      const temp = parseFloat(r.temperature);
      const hum = parseFloat(r.humidity);
      const aqi = parseFloat(r.air_quality);
      if (!isNaN(temp)) masterTempSlots[slot] = temp;
      if (!isNaN(hum)) masterHumSlots[slot] = hum;
      if (!isNaN(aqi)) masterAqiSlots[slot] = aqi;
    });

    // give the latest data point a bigger dot — like a "live edge" indicator
    [masterChart, masterLargeChart].forEach(ch => {
      if (!ch) return;
      ch.data.datasets.forEach(ds => {
        ds.pointRadius = ds.data.map((val, idx) => (val !== null && idx === lastSlotIndex) ? 6 : 2);
        ds.pointHoverRadius = ds.data.map((val, idx) => (val !== null && idx === lastSlotIndex) ? 8 : 5);
      });
    });

    updateMasterBoth(masterTempSlots, masterHumSlots, masterAqiSlots);

    // ── 7-Day tile charts: daily averages for the last 7 days ──
    // slot 0 = 6 days ago, slot 6 = today
    const tempSums = new Array(7).fill(0);
    const humSums = new Array(7).fill(0);
    const aqiSums = new Array(7).fill(0);
    const dayCounts = new Array(7).fill(0);  // how many readings in each day (for averaging)

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);  // midnight of today in local time

    raw.forEach(r => {
      if (!r.created_at) return;
      const d = new Date(r.created_at);
      const dMidnight = new Date(d);
      dMidnight.setHours(0, 0, 0, 0);  // midnight of this row's day

      // how many full days ago was this reading?
      const msAgo = todayMidnight.getTime() - dMidnight.getTime();
      const daysAgo = Math.round(msAgo / 86400000);  // 86400000 ms = 1 day

      if (daysAgo < 0 || daysAgo > 6) return;  // skip readings older than 7 days or future dates
      const slot = 6 - daysAgo;   // convert daysAgo to slot index (today = 6, 6 days ago = 0)
      const temp = parseFloat(r.temperature);
      const hum = parseFloat(r.humidity);
      const aqi = parseFloat(r.air_quality);
      if (!isNaN(temp)) { tempSums[slot] += temp; dayCounts[slot]++; }
      if (!isNaN(hum)) { humSums[slot] += hum; }
      if (!isNaN(aqi)) { aqiSums[slot] += aqi; }
    });

    // divide sums by count to get daily averages, or 0 if no data that day
    const tempSlots = tempSums.map((s, i) => dayCounts[i] ? parseFloat((s / dayCounts[i]).toFixed(1)) : 0);
    const humSlots = humSums.map((s, i) => dayCounts[i] ? parseFloat((s / dayCounts[i]).toFixed(1)) : 0);
    const aqiSlots = aqiSums.map((s, i) => dayCounts[i] ? parseFloat((s / dayCounts[i]).toFixed(1)) : 0);

    updateTile(tempTileChart, tempSlots);
    updateTile(humTileChart, humSlots);
    updateTile(aqiTileChart, aqiSlots);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MASTER MODAL — fullscreen version of the master chart
  // when opened, copies the current data from the small chart into the large canvas
  // and calls resize() so Chart.js re-renders at the new size
  // ─────────────────────────────────────────────────────────────────────────────
  window.openMasterModal = function () {
    const el = document.getElementById("masterModal");
    if (!el) return;
    el.classList.add("is-open");  // class-driven visibility — works with CSS transitions
    setTimeout(() => {
      if (masterLargeChart) {
        // sync data from the small chart to the large one before resizing
        masterLargeChart.data.labels = masterChart?.data.labels ?? [];
        masterLargeChart.data.datasets.forEach((ds, i) => {
          ds.data = masterChart?.data.datasets[i]?.data ?? [];
        });
        masterLargeChart.resize();
        masterLargeChart.update("none");
      }
    }, 60);  // 60ms gives the CSS transition time to start before we resize the canvas
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // BOOT
  // wait for DOMContentLoaded so the canvas elements exist before building charts
  // then do an initial render, and then re-fetch every 10 seconds to stay in sync
  // ─────────────────────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    initCharts();
    setTimeout(fetchAndRender, 1500);  // wait 1.5s so script.js has time to do its first fetch first
    setInterval(fetchAndRender, 10000);  // re-sync every 10s (matches script.js fetchHistory interval)
  });

})();
