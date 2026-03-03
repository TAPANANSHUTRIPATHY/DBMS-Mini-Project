/* ================================================================
   forecast.js — 24-Hour Forecast Layer
   Fetches 24-hour localized forecast from Open-Meteo APIs:
     • Weather API  → temperature, humidity
     • Air Quality API → US AQI
   Renders:
     • Master Graph (full day 00:00–23:59): Temp + Humidity + AQI
     • 3 individual 24-h tiles: Temp, Humidity, AQI
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

    function ctx(id) { const e = document.getElementById(id); return e ? e.getContext("2d") : null; }

    let charts = { temp: null, hum: null, aqi: null, master: null };

    /* ── Single-metric line chart ── */
    function makeForecastChart(canvasId, label, color) {
        const c = ctx(canvasId);
        if (!c) return null;
        return new Chart(c, {
            type: "line",
            data: {
                labels: [], datasets: [{
                    label, borderColor: color,
                    backgroundColor: rgba(color, 0.12), data: [], tension: 0.4,
                    pointRadius: 1.5, pointHoverRadius: 6, pointBackgroundColor: color,
                    fill: true, borderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 800, easing: "easeOutQuart" },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: "index", intersect: false, backgroundColor: "rgba(6,16,30,0.93)",
                        borderColor: color, borderWidth: 1, titleColor: TICK, bodyColor: "#fff",
                        titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12
                    },
                },
                scales: {
                    x: { ticks: { color: TICK, maxTicksLimit: 12, maxRotation: 45, font: { family: FONT, size: 10 } }, grid: { color: GRID } },
                    y: { ticks: { color: TICK, maxTicksLimit: 6, font: { family: FONT, size: 10 } }, grid: { color: GRID } },
                },
            },
        });
    }

    /* ── Master 3-dataset chart (Temp | Humidity | AQI) ── */
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
                        data: [], tension: 0.4, pointRadius: 1, borderWidth: 2, yAxisID: "y"
                    },
                    {
                        label: "Humidity (%)", borderColor: COLORS.hum,
                        backgroundColor: rgba(COLORS.hum, 0.08),
                        data: [], tension: 0.4, pointRadius: 1, borderWidth: 2, yAxisID: "y1"
                    },
                    {
                        label: "Air Quality Index", borderColor: COLORS.aqi,
                        backgroundColor: rgba(COLORS.aqi, 0.08),
                        data: [], tension: 0.4, pointRadius: 1, borderWidth: 2, yAxisID: "y2"
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 800, easing: "easeOutQuart" },
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: { display: true, labels: { color: TICK, font: { family: FONT, size: 12 }, boxWidth: 20 } },
                    tooltip: {
                        backgroundColor: "rgba(6,16,30,0.93)",
                        titleColor: TICK, bodyColor: "#fff",
                        titleFont: { family: FONT, size: 12 }, bodyFont: { family: FONT, size: 13 }, padding: 12
                    },
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
                },
            },
        });
    }

    function initCharts() {
        charts.temp = makeForecastChart("foreTempChart", "Temperature (°C)", COLORS.temp);
        charts.hum = makeForecastChart("foreHumChart", "Humidity (%)", COLORS.hum);
        charts.aqi = makeForecastChart("foreAqiChart", "Air Quality Index (US AQI)", COLORS.aqi);
        charts.master = makeMasterChart("masterForeChart");
    }

    /* ── Format "2026-03-03T14:00" → "2 PM" ── */
    function formatTime(t) {
        const d = new Date(t);
        let h = d.getHours();
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        return `${h} ${ampm}`;
    }

    /* ── Build local YYYY-MM-DD for current day ── */
    function localYMD(date) {
        return date.getFullYear() + "-"
            + String(date.getMonth() + 1).padStart(2, "0") + "-"
            + String(date.getDate()).padStart(2, "0");
    }

    async function fetchForecast() {
        const lat = localStorage.getItem("user_lat") || "20.3533";
        const lon = localStorage.getItem("user_lon") || "85.8266";

        try {
            /* Fetch weather + AQI in parallel */
            const [wxRes, aqRes] = await Promise.all([
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m&timezone=auto&forecast_days=2`),
                fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=us_aqi&timezone=auto&forecast_days=2`)
            ]);

            if (!wxRes.ok || !aqRes.ok) return;
            const wx = await wxRes.json();
            const aq = await aqRes.json();

            if (!wx?.hourly || !aq?.hourly) return;

            const now = new Date();
            const todayStr = localYMD(now);

            /* ── Find index of current hour in weather data ── */
            let startIdx = 0;
            for (let i = 0; i < wx.hourly.time.length; i++) {
                if (new Date(wx.hourly.time[i]) >= now) { startIdx = i; break; }
            }

            /* ── Next-24h slices ── */
            const times24 = wx.hourly.time.slice(startIdx, startIdx + 24);
            const temps24 = wx.hourly.temperature_2m.slice(startIdx, startIdx + 24);
            const hums24 = wx.hourly.relative_humidity_2m.slice(startIdx, startIdx + 24);

            /* AQI times may differ in length — align by matching timestamps */
            const aqMap = {};
            aq.hourly.time.forEach((t, i) => { aqMap[t] = aq.hourly.us_aqi[i]; });
            const aqis24 = times24.map(t => aqMap[t] ?? null);

            const labels24 = times24.map(formatTime);

            /* Individual tiles */
            if (charts.temp) { charts.temp.data.labels = labels24; charts.temp.data.datasets[0].data = temps24; charts.temp.update(); }
            if (charts.hum) { charts.hum.data.labels = labels24; charts.hum.data.datasets[0].data = hums24; charts.hum.update(); }
            if (charts.aqi) { charts.aqi.data.labels = labels24; charts.aqi.data.datasets[0].data = aqis24; charts.aqi.update(); }

            /* ── Master graph: today 00:00–23:59 ── */
            let todayStartIdx = 0;
            for (let i = 0; i < wx.hourly.time.length; i++) {
                if (wx.hourly.time[i].substring(0, 10) === todayStr) { todayStartIdx = i; break; }
            }
            const masterTimes = wx.hourly.time.slice(todayStartIdx, todayStartIdx + 24);
            const masterLabels = masterTimes.map(formatTime);
            const masterTemps = wx.hourly.temperature_2m.slice(todayStartIdx, todayStartIdx + 24);
            const masterHums = wx.hourly.relative_humidity_2m.slice(todayStartIdx, todayStartIdx + 24);
            const masterAqis = masterTimes.map(t => aqMap[t] ?? null);

            if (charts.master) {
                charts.master.data.labels = masterLabels;
                charts.master.data.datasets[0].data = masterTemps;
                charts.master.data.datasets[1].data = masterHums;
                charts.master.data.datasets[2].data = masterAqis;
                charts.master.update();
            }

        } catch (err) {
            console.error("Forecast fetch error:", err);
        }
    }

    window.addEventListener("DOMContentLoaded", () => { initCharts(); fetchForecast(); });
    window.addEventListener("locationUpdated", () => { fetchForecast(); });

})();
