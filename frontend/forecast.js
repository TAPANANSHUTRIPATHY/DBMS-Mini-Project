/* ================================================================
   forecast.js — Master + Forecast Charts powered by Supabase DB
   ─ NO Open-Meteo, NO dummy values.
   ─ ALL data comes from the backend API (same as script.js).
   ─ If backend is offline or no data → charts stay empty.
   ─ Sources:
       • Today's Master Graph → `window.ENVDATA` history bus
       • 24-h forecast tiles  → last 24h sliced from full history
   ─ Re-renders every 10 s to stay in sync.
================================================================ */

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

    function rgba(c, a) {
        return c.replace("rgb(", "rgba(").replace(")", `,${a})`);
    }

    function ctx(id) {
        const e = document.getElementById(id);
        return e ? e.getContext("2d") : null;
    }

    /* ── Small stat labels shown in tile-actions ── */
    function setEl(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

    /* ── Single-metric tile chart — fixed 7-day axis ── */
    /* Build labels: today = slot[6], 6 days ago = slot[0] */
    function make7DayLabels() {
        const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));   /* oldest first */
            return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
        });
    }
    const WEEK_LABELS = make7DayLabels();

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
                    data: new Array(7).fill(null),   /* null = no data */
                    tension: 0.4,
                    pointRadius: 5, pointHoverRadius: 8,
                    pointBackgroundColor: color,
                    fill: true,
                    borderWidth: 2.5,
                    spanGaps: false   /* break line at missing days */
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 600, easing: "easeOutQuart" },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: "index", intersect: false, backgroundColor: "rgba(6,16,30,0.93)",
                        borderColor: color, borderWidth: 1, titleColor: TICK, bodyColor: "#fff",
                        titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12,
                        callbacks: {
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

    /* ── 3-dataset master chart ── Fixed 24-hour axis, null gaps */
    /* Labels: "00:00", "01:00" … "23:00" */
    const MASTER_HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

    function makeMasterChart(canvasId) {
        const c = ctx(canvasId);
        if (!c) return null;
        return new Chart(c, {
            type: "line",
            data: {
                labels: MASTER_HOURS,
                datasets: [
                    {
                        label: "Temperature (°C)", borderColor: COLORS.temp,
                        backgroundColor: rgba(COLORS.temp, 0.08),
                        data: new Array(24).fill(null),
                        tension: 0.4, pointRadius: 2, pointHoverRadius: 5,
                        borderWidth: 2.5, yAxisID: "y", fill: false,
                        spanGaps: false
                    },
                    {
                        label: "Humidity (%)", borderColor: COLORS.hum,
                        backgroundColor: rgba(COLORS.hum, 0.08),
                        data: new Array(24).fill(null),
                        tension: 0.4, pointRadius: 2, pointHoverRadius: 5,
                        borderWidth: 2.5, yAxisID: "y1", fill: false,
                        spanGaps: false
                    },
                    {
                        label: "Air Quality Index", borderColor: COLORS.aqi,
                        backgroundColor: rgba(COLORS.aqi, 0.08),
                        data: new Array(24).fill(null),
                        tension: 0.4, pointRadius: 2, pointHoverRadius: 5,
                        borderWidth: 2.5, yAxisID: "y2", fill: false,
                        spanGaps: false
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: false,
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
                        ticks: { color: TICK, font: { family: FONT, size: 10 }, maxTicksLimit: 24 },
                        grid: { color: GRID }
                    },
                    y: {
                        type: "linear", position: "left",
                        ticks: { color: COLORS.temp, font: { family: FONT, size: 10 } },
                        grid: { color: GRID },
                        title: { display: true, text: "Temp (°C)", color: COLORS.temp, font: { family: FONT, size: 10 } }
                    },
                    y1: {
                        type: "linear", position: "right",
                        ticks: { color: COLORS.hum, font: { family: FONT, size: 10 } },
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: "Humidity (%)", color: COLORS.hum, font: { family: FONT, size: 10 } }
                    },
                    y2: {
                        type: "linear", position: "right",
                        ticks: { color: COLORS.aqi, font: { family: FONT, size: 10 } },
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: "AQI", color: COLORS.aqi, font: { family: FONT, size: 10 } }
                    }
                }
            }
        });
    }

    /* ── Chart instances ── */
    let masterChart = null;
    let masterLargeChart = null;
    let tempTileChart = null;
    let humTileChart = null;
    let aqiTileChart = null;

    function initCharts() {
        masterChart = makeMasterChart("masterForeChart");
        masterLargeChart = makeMasterChart("masterLargeCanvas");
        tempTileChart = makeTileChart("foreTempChart", "Temperature (°C)", COLORS.temp);
        humTileChart = makeTileChart("foreHumChart", "Humidity (%)", COLORS.hum);
        aqiTileChart = makeTileChart("foreAqiChart", "Air Quality Index", COLORS.aqi);
    }

    /* ── Clear all charts (no data) ── */
    function clearAll() {
        /* Master charts: reset to 24 nulls */
        [masterChart, masterLargeChart].forEach(ch => {
            if (!ch) return;
            ch.data.datasets.forEach(ds => (ds.data = new Array(24).fill(null)));
            ch.update("none");
        });
        /* Tile charts: reset to 7 nulls (keeps 7-day axis, line flat/empty) */
        [tempTileChart, humTileChart, aqiTileChart].forEach(ch => {
            if (!ch) return;
            ch.data.datasets[0].data = new Array(7).fill(null);
            ch.update("none");
        });
    }

    /* ── Update a single-metric 7-day tile chart ── */
    /* data7 = array of 7 values (or null), index 0 = 6 days ago, index 6 = today */
    function updateTile(chart, data7) {
        if (!chart) return;
        chart.data.datasets[0].data = data7;
        chart.update("none");
    }

    /* ── Update master charts (small + large) with 24-slot arrays ── */
    function updateMasterBoth(tempSlots, humSlots, aqiSlots) {
        [masterChart, masterLargeChart].forEach(ch => {
            if (!ch) return;
            ch.data.datasets[0].data = tempSlots;
            ch.data.datasets[1].data = humSlots;
            ch.data.datasets[2].data = aqiSlots;
            ch.update("none");
        });
    }

    /* ── Main fetch from DB ── */
    let _lastRenderTs = "";
    async function fetchAndRender() {
        const D = window.ENVDATA;
        if (!D || !D.backendOnline) { clearAll(); return; }

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
                break;
            } catch (_) { continue; }
        }

        /* No data from DB → clear charts, show nothing */
        if (!raw) { clearAll(); return; }

        /* Sort by time ascending */
        raw.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const lastTs = raw[raw.length - 1]?.created_at || "";
        if (lastTs === _lastRenderTs) return;   /* nothing new */
        _lastRenderTs = lastTs;

        const now = new Date();
        const todayStr = now.getFullYear() + "-"
            + String(now.getMonth() + 1).padStart(2, "0") + "-"
            + String(now.getDate()).padStart(2, "0");

        /* ── Today's full-day data — compare LOCAL date (DB stores UTC, IST=+5:30) ── */
        const todayRows = raw.filter(r => {
            if (!r.created_at) return false;
            const d = new Date(r.created_at);
            const localDate = d.getFullYear() + "-"
                + String(d.getMonth() + 1).padStart(2, "0") + "-"
                + String(d.getDate()).padStart(2, "0");
            return localDate === todayStr;
        });

        /* ── Master graph: today's data bucketed by hour slot (null = no reading) ── */
        const masterTempSlots = new Array(24).fill(null);
        const masterHumSlots = new Array(24).fill(null);
        const masterAqiSlots = new Array(24).fill(null);

        todayRows.forEach(r => {
            const hour = new Date(r.created_at).getHours();
            const temp = parseFloat(r.temperature);
            const hum = parseFloat(r.humidity);
            const aqi = parseFloat(r.air_quality);
            if (!isNaN(temp)) masterTempSlots[hour] = temp;
            if (!isNaN(hum)) masterHumSlots[hour] = hum;
            if (!isNaN(aqi)) masterAqiSlots[hour] = aqi;
        });

        updateMasterBoth(masterTempSlots, masterHumSlots, masterAqiSlots);

        /* ── 7-day tile charts: daily averages bucketed by day slot (null = no data) ── */
        /* slot 0 = 6 days ago, slot 6 = today */
        const tempSums = new Array(7).fill(0);
        const humSums = new Array(7).fill(0);
        const aqiSums = new Array(7).fill(0);
        const dayCounts = new Array(7).fill(0);

        const nowMs = Date.now();
        raw.forEach(r => {
            if (!r.created_at) return;
            const d = new Date(r.created_at);
            const msAgo = nowMs - d.getTime();
            const daysAgo = Math.floor(msAgo / (86400000));  /* 0 = today, 1 = yesterday … */
            if (daysAgo > 6) return;    /* older than 7 days — skip */
            const slot = 6 - daysAgo;   /* slot 6 = today, slot 0 = 6 days ago */
            const temp = parseFloat(r.temperature);
            const hum = parseFloat(r.humidity);
            const aqi = parseFloat(r.air_quality);
            if (!isNaN(temp)) { tempSums[slot] += temp; dayCounts[slot]++; }
            if (!isNaN(hum)) { humSums[slot] += hum; }
            if (!isNaN(aqi)) { aqiSums[slot] += aqi; }
        });

        const tempSlots = tempSums.map((s, i) => dayCounts[i] ? parseFloat((s / dayCounts[i]).toFixed(1)) : null);
        const humSlots = humSums.map((s, i) => dayCounts[i] ? parseFloat((s / dayCounts[i]).toFixed(1)) : null);
        const aqiSlots = aqiSums.map((s, i) => dayCounts[i] ? parseFloat((s / dayCounts[i]).toFixed(1)) : null);

        updateTile(tempTileChart, tempSlots);
        updateTile(humTileChart, humSlots);
        updateTile(aqiTileChart, aqiSlots);
    }

    /* ── Fullscreen handler for master ── */
    window.openMasterModal = function () {
        const el = document.getElementById("masterModal");
        if (!el) return;
        el.style.display = "flex";
        /* Re-sync large chart after resize */
        setTimeout(() => {
            if (masterLargeChart) {
                masterLargeChart.data.labels = masterChart?.data.labels ?? [];
                masterLargeChart.data.datasets.forEach((ds, i) => {
                    ds.data = masterChart?.data.datasets[i]?.data ?? [];
                });
                masterLargeChart.resize();
                masterLargeChart.update("none");
            }
        }, 60);
    };

    /* ── Boot ── */
    document.addEventListener("DOMContentLoaded", () => {
        initCharts();
        /* Wait briefly for script.js to do its first fetch, then sync */
        setTimeout(fetchAndRender, 1500);
        /* Refresh every 10 s to match script.js history poll */
        setInterval(fetchAndRender, 10000);
    });

})();
