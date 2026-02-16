const API_URL = "http://localhost:5000/api";

/* ===================== */
/*      DOM ELEMENTS     */
/* ===================== */

const tempEl = document.getElementById("temp");
const humEl = document.getElementById("hum");
const airEl = document.getElementById("air");
const airStatusEl = document.getElementById("airStatus");
const airCard = document.getElementById("airCard");

const tempHumCtx = document.getElementById("tempHumChart")?.getContext("2d");
const airCtx = document.getElementById("airChart")?.getContext("2d");
const tempHumLargeCtx = document.getElementById("tempHumLarge")?.getContext("2d");
const airLargeCtx = document.getElementById("airLarge")?.getContext("2d");

const airGaugeCtx = document.getElementById("airGauge")?.getContext("2d");
const tempGaugeCtx = document.getElementById("tempGauge")?.getContext("2d");

const airGaugeValue = document.getElementById("airGaugeValue");
const tempGaugeValue = document.getElementById("tempGaugeValue");

/* ===================== */
/*   AIR STATUS LOGIC    */
/* ===================== */

function getAirStatus(value) {
  if (value < 1000) return { text: "🟢 Clean", color: "#00ff00" };
  if (value < 2000) return { text: "🟡 Moderate", color: "#ffaa00" };
  return { text: "🔴 Poor", color: "#ff0000" };
}

/* ===================== */
/*       CHARTS          */
/* ===================== */

let tempHumChart = null;
let airChart = null;
let tempHumLargeChart = null;
let airLargeChart = null;

/* Small Graph */
if (tempHumCtx) {
  tempHumChart = new Chart(tempHumCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Temperature (°C)",
          borderColor: "#ff4d4d",
          backgroundColor: "rgba(255,77,77,0.2)",
          data: [],
          tension: 0.4
        },
        {
          label: "Humidity (%)",
          borderColor: "#00ffff",
          backgroundColor: "rgba(0,255,255,0.2)",
          data: [],
          tension: 0.4
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "white" } } },
      scales: {
        x: { ticks: { color: "white" } },
        y: { ticks: { color: "white" } }
      }
    }
  });
}

if (airCtx) {
  airChart = new Chart(airCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Air Quality",
          borderColor: "#00ff00",
          backgroundColor: "rgba(0,255,0,0.2)",
          data: [],
          tension: 0.4
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "white" } } },
      scales: {
        x: { ticks: { color: "white" } },
        y: { ticks: { color: "white" } }
      }
    }
  });
}

/* Large popup graphs */
if (tempHumLargeCtx) {
  tempHumLargeChart = new Chart(tempHumLargeCtx, {
    type: "line",
    data: { labels: [], datasets: [] }
  });
}

if (airLargeCtx) {
  airLargeChart = new Chart(airLargeCtx, {
    type: "line",
    data: { labels: [], datasets: [] }
  });
}

/* ===================== */
/*         GAUGES        */
/* ===================== */

let airGauge = null;
let tempGauge = null;

if (airGaugeCtx) {
  airGauge = new Chart(airGaugeCtx, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [0, 3000],
        backgroundColor: ["#00ff00", "#1e293b"],
        borderWidth: 0
      }]
    },
    options: {
      rotation: -90,
      circumference: 180,
      cutout: "75%",
      plugins: { legend: { display: false } }
    }
  });
}

if (tempGaugeCtx) {
  tempGauge = new Chart(tempGaugeCtx, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [0, 50],
        backgroundColor: ["#ff4d4d", "#1e293b"],
        borderWidth: 0
      }]
    },
    options: {
      rotation: -90,
      circumference: 180,
      cutout: "75%",
      plugins: { legend: { display: false } }
    }
  });
}

/* ===================== */
/*       FETCH DATA      */
/* ===================== */

async function fetchLatest() {
  const res = await fetch(`${API_URL}/latest`);
  const data = await res.json();
  if (!data) return;

  tempEl.textContent = data.temperature + " °C";
  humEl.textContent = data.humidity + " %";
  airEl.textContent = data.air_quality;

  const status = getAirStatus(data.air_quality);
  airStatusEl.textContent = status.text;
  airCard.style.boxShadow = `0 0 30px ${status.color}`;

  /* Update Gauges */
  if (airGauge) {
    airGauge.data.datasets[0].data = [data.air_quality, 3000 - data.air_quality];
    airGauge.data.datasets[0].backgroundColor[0] = status.color;
    airGauge.update();
    airGaugeValue.innerText = data.air_quality;
  }

  if (tempGauge) {
    tempGauge.data.datasets[0].data = [data.temperature, 50 - data.temperature];
    tempGauge.update();
    tempGaugeValue.innerText = data.temperature + " °C";
  }
}

async function fetchHistory() {
  const res = await fetch(`${API_URL}/history`);
  const data = await res.json();

  const labels = data.map(d =>
    new Date(d.created_at).toLocaleTimeString()
  );

  if (tempHumChart) {
    tempHumChart.data.labels = labels;
    tempHumChart.data.datasets[0].data = data.map(d => d.temperature);
    tempHumChart.data.datasets[1].data = data.map(d => d.humidity);
    tempHumChart.update();
  }

  if (airChart) {
    airChart.data.labels = labels;
    airChart.data.datasets[0].data = data.map(d => d.air_quality);
    airChart.update();
  }

  if (tempHumLargeChart && tempHumChart) {
    tempHumLargeChart.data.labels = labels;
    tempHumLargeChart.data.datasets =
      JSON.parse(JSON.stringify(tempHumChart.data.datasets));
    tempHumLargeChart.update();
  }

  if (airLargeChart && airChart) {
    airLargeChart.data.labels = labels;
    airLargeChart.data.datasets =
      JSON.parse(JSON.stringify(airChart.data.datasets));
    airLargeChart.update();
  }
}

/* ===================== */
/*     MODAL CONTROL     */
/* ===================== */

function openModal(id) {
  document.getElementById(id).style.display = "block";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

/* ===================== */
/*     EXPORT CSV        */
/* ===================== */

document.getElementById("exportBtn")?.addEventListener("click", async () => {
  const res = await fetch(`${API_URL}/history`);
  const data = await res.json();

  let csv = "Temperature,Humidity,Air Quality,Time\n";
  data.forEach(row => {
    csv += `${row.temperature},${row.humidity},${row.air_quality},${row.created_at}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sensor_data.csv";
  a.click();
});

/* ===================== */
/*     AUTO REFRESH      */
/* ===================== */

setInterval(() => {
  fetchLatest();
  fetchHistory();
}, 3000);

fetchLatest();
fetchHistory();
