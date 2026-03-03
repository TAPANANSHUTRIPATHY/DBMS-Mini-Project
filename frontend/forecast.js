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

    /* ── Single-metric tile chart with fixed 24-slot time axis ── */
    function makeTileChart(canvasId, label, color) {
        const c = ctx(canvasId);
        if (!c) return null;

        /* Fixed 24-hour labels: "12 AM", "1 AM" … "11 PM" */
        const HOURS_24 = Array.from({ length: 24 }, (_, h) => {
            const ampm = h < 12 ? "AM" : "PM";
            const disp = h === 0 ? 12 : h > 12 ? h - 12 : h;
            return `${disp} ${ampm}`;
        });

        return new Chart(c, {
            type: "line",
            data: {
                labels: HOURS_24,
                datasets: [{
                    label, borderColor: color,
                    backgroundColor: rgba(color, 0.10),
                    data: new Array(24).fill(null),   /* all null by default */
                    tension: 0.4,
                    pointRadius: 3, pointHoverRadius: 6,
                    pointBackgroundColor: color,
                    fill: false,         /* no fill into null regions */
                    borderWidth: 2,
                    spanGaps: false      /* break line at null = no data */
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: "index", intersect: false, backgroundColor: "rgba(6,16,30,0.93)",
                        borderColor: color, borderWidth: 1, titleColor: TICK, bodyColor: "#fff",
                        titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12,
                        callbacks: {
                            label: ctx => ctx.parsed.y === null ? null : `${label}: ${ctx.parsed.y}`
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: TICK, maxTicksLimit: 12, maxRotation: 45, font: { family: FONT, size: 10 } }, grid: { color: GRID } },
                    y: { ticks: { color: color, maxTicksLimit: 6, font: { family: FONT, size: 10 } }, grid: { color: GRID } }
                }
            }
        });
    }

    /* ── 3-dataset master chart (Temp | Humidity | AQI, dual axis) ── */
    function makeMasterChart(canvasId) {
        const c = ctx(canvasId);
        if (!c) return null;
        return new Chart(c, {
            type: "line",
            data: {
                labels: [],
                datasets: [
                    {
                        label: "Temperature (°C)", borderColor: COLORS.temp,
                        backgroundColor: rgba(COLORS.temp, 0.08),
                        data: [], tension: 0.4, pointRadius: 0, pointHoverRadius: 5,
                        borderWidth: 2.5, yAxisID: "y", fill: true
                    },
                    {
                        label: "Humidity (%)", borderColor: COLORS.hum,
                        backgroundColor: rgba(COLORS.hum, 0.08),
                        data: [], tension: 0.4, pointRadius: 0, pointHoverRadius: 5,
                        borderWidth: 2.5, yAxisID: "y1", fill: true
                    },
                    {
                        label: "Air Quality Index", borderColor: COLORS.aqi,
                        backgroundColor: rgba(COLORS.aqi, 0.08),
                        data: [], tension: 0.4, pointRadius: 0, pointHoverRadius: 5,
                        borderWidth: 2.5, yAxisID: "y2", fill: true
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
                        titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12
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
        /* Master charts: wipe labels + data */
        [masterChart, masterLargeChart].forEach(ch => {
            if (!ch) return;
            ch.data.labels = [];
            ch.data.datasets.forEach(ds => (ds.data = []));
            ch.update("none");
        });
        /* Tile charts: reset to 24 nulls (keeps time axis, line goes flat/empty) */
        [tempTileChart, humTileChart, aqiTileChart].forEach(ch => {
            if (!ch) return;
            ch.data.datasets[0].data = new Array(24).fill(null);
            ch.update("none");
        });
    }

    /* ── Update a single-metric 24-h tile chart ── */
    /* data24 = array of 24 values (or null), indexed by hour 0–23 */
    function updateTile(chart, data24) {
        if (!chart) return;
        chart.data.datasets[0].data = data24;
        chart.update("none");
    }

    /* ── Update master chart (both small and large canvases) ── */
    function updateMasterBoth(labels, temps, hums, aqis) {
        [masterChart, masterLargeChart].forEach(ch => {
            if (!ch) return;
            ch.data.labels = labels;
            ch.data.datasets[0].data = temps;
            ch.data.datasets[1].data = hums;
            ch.data.datasets[2].data = aqis;
            ch.update("none");
        });
    }

    /* ── Sync from window.ENVDATA ── */
    function sync() {
        const D = window.ENVDATA;

        /* If backend offline or no data → clear everything, show nothing */
        if (!D || !D.backendOnline || !D.ready || !D.labels.length) {
            clearAll();
            return;
        }

        /* Grab the full history from the shared bus */
        const allLabels = D.labels;   /* HH:MM:SS strings */
        const allTemps = D.temps;
        const allHums = D.hums;
        const allAqis = D.aqis;

        /* ── Today's Master Graph: filter only today's readings ── */
        const todayStr = (() => {
            const n = new Date();
            return n.getFullYear() + "-"
                + String(n.getMonth() + 1).padStart(2, "0") + "-"
                + String(n.getDate()).padStart(2, "0");
        })();

        /* ENVDATA.labels are "HH:MM:SS" — we need created_at or actual date.
           Script.js window bus only carries time labels, not full ISO dates.
           We fetch full history directly from the history endpoint instead. */
        fetchAndRender();
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

        /* ── Today's full-day data for master graph ── */
        const todayRows = raw.filter(r => r.created_at && r.created_at.substring(0, 10) === todayStr);

        if (todayRows.length) {
            const masterLabels = todayRows.map(r => {
                const d = new Date(r.created_at);
                return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            });
            updateMasterBoth(
                masterLabels,
                todayRows.map(r => parseFloat(r.temperature)),
                todayRows.map(r => parseFloat(r.humidity)),
                todayRows.map(r => parseFloat(r.air_quality))
            );
        } else {
            /* No today's data yet */
            [masterChart, masterLargeChart].forEach(ch => {
                if (!ch) return;
                ch.data.labels = [];
                ch.data.datasets.forEach(ds => (ds.data = []));
                ch.update("none");
            });
        }

        /* ── 24-hour tile charts: fixed 24-slot time axis, null where no data ── */
        /* Build hour-buckets for ALL 24 hours of today */
        /* We use the LAST reading per hour slot (most recent sensor value that hour) */
        const tempSlots = new Array(24).fill(null);
        const humSlots = new Array(24).fill(null);
        const aqiSlots = new Array(24).fill(null);

        /* Use today's DB rows to populate slots */
        todayRows.forEach(r => {
            const hour = new Date(r.created_at).getHours(); /* 0–23 */
            const temp = parseFloat(r.temperature);
            const hum = parseFloat(r.humidity);
            const aqi = parseFloat(r.air_quality);
            if (!isNaN(temp)) tempSlots[hour] = temp;
            if (!isNaN(hum)) humSlots[hour] = hum;
            if (!isNaN(aqi)) aqiSlots[hour] = aqi;
        });

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
