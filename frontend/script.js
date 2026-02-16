const API_URL = "http://localhost:5000/api";

const tempEl = document.getElementById("temp");
const humEl = document.getElementById("hum");
const airEl = document.getElementById("air");
const airStatusEl = document.getElementById("airStatus");
const airCard = document.getElementById("airCard");

const tempHumCtx = document.getElementById("tempHumChart").getContext("2d");
const airCtx = document.getElementById("airChart").getContext("2d");
const gaugeCtx = document.getElementById("gaugeChart").getContext("2d");

const tempHumLargeCtx = document.getElementById("tempHumLarge").getContext("2d");
const airLargeCtx = document.getElementById("airLarge").getContext("2d");

/* ============================= */
/*        AIR STATUS LOGIC       */
/* ============================= */

function getAirStatus(value) {
  if (value < 1000) return { text: "🟢 Clean", color: "#00ff00" };
  if (value < 2000) return { text: "🟡 Moderate", color: "#ffaa00" };
  return { text: "🔴 Poor", color: "#ff0000" };
}

/* ============================= */
/*      SMALL DASHBOARD GRAPHS   */
/* ============================= */

const tempHumChart = new Chart(tempHumCtx, {
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

const airChart = new Chart(airCtx, {
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

/* ============================= */
/*          GAUGE CHART          */
/* ============================= */

const gaugeChart = new Chart(gaugeCtx, {
  type: "doughnut",
  data: {
    labels: ["Air Quality"],
    datasets: [{
      data: [0, 3000],
      backgroundColor: ["#00ff00", "#222"],
      borderWidth: 0
    }]
  },
  options: {
    circumference: 180,
    rotation: 270,
    cutout: "70%",
    plugins: {
      legend: { display: false }
    }
  }
});

/* ============================= */
/*       LARGE POPUP GRAPHS      */
/* ============================= */

let tempHumLargeChart = new Chart(tempHumLargeCtx, {
  type: "line",
  data: { labels: [], datasets: [] }
});

let airLargeChart = new Chart(airLargeCtx, {
  type: "line",
  data: { labels: [], datasets: [] }
});

/* ============================= */
/*        FETCH FUNCTIONS        */
/* ============================= */

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

  /* Update Gauge */
  gaugeChart.data.datasets[0].data = [data.air_quality, 3000 - data.air_quality];
  gaugeChart.data.datasets[0].backgroundColor[0] = status.color;
  gaugeChart.update();
}

async function fetchHistory() {
  const res = await fetch(`${API_URL}/history`);
  const data = await res.json();

  const labels = data.map(d =>
    new Date(d.created_at).toLocaleTimeString()
  );

  /* Update small graphs */
  tempHumChart.data.labels = labels;
  tempHumChart.data.datasets[0].data = data.map(d => d.temperature);
  tempHumChart.data.datasets[1].data = data.map(d => d.humidity);

  airChart.data.labels = labels;
  airChart.data.datasets[0].data = data.map(d => d.air_quality);

  tempHumChart.update();
  airChart.update();

  /* Update large popup graphs */
  tempHumLargeChart.data.labels = labels;
  tempHumLargeChart.data.datasets = JSON.parse(JSON.stringify(tempHumChart.data.datasets));
  tempHumLargeChart.update();

  airLargeChart.data.labels = labels;
  airLargeChart.data.datasets = JSON.parse(JSON.stringify(airChart.data.datasets));
  airLargeChart.update();
}

/* ============================= */
/*         MODAL CONTROL         */
/* ============================= */

function openModal(id) {
  document.getElementById(id).style.display = "block";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

/* ============================= */
/*        AUTO REFRESH           */
/* ============================= */

setInterval(() => {
  fetchLatest();
  fetchHistory();
}, 3000);

fetchLatest();
fetchHistory();
