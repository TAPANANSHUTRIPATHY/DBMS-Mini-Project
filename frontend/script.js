const API_URL = "http://localhost:5000/api";

const tempEl = document.getElementById("temp");
const humEl = document.getElementById("hum");
const airEl = document.getElementById("air");

const tempHumCtx = document.getElementById('tempHumChart').getContext('2d');
const airCtx = document.getElementById('airChart').getContext('2d');

const tempHumChart = new Chart(tempHumCtx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      {
        label: 'Temperature (°C)',
        borderColor: '#ff4d4d',
        backgroundColor: 'rgba(255,77,77,0.2)',
        data: [],
        tension: 0.4
      },
      {
        label: 'Humidity (%)',
        borderColor: '#00ffff',
        backgroundColor: 'rgba(0,255,255,0.2)',
        data: [],
        tension: 0.4
      }
    ]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { labels: { color: "white" } }
    },
    scales: {
      x: { ticks: { color: "white" } },
      y: { ticks: { color: "white" } }
    }
  }
});

const airChart = new Chart(airCtx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      {
        label: 'Air Quality',
        borderColor: '#00ff00',
        backgroundColor: 'rgba(0,255,0,0.2)',
        data: [],
        tension: 0.4
      }
    ]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { labels: { color: "white" } }
    },
    scales: {
      x: { ticks: { color: "white" } },
      y: { ticks: { color: "white" } }
    }
  }
});

async function fetchLatest() {
  const res = await fetch(`${API_URL}/latest`);
  const data = await res.json();

  if (!data) return;

  tempEl.textContent = data.temperature + " °C";
  humEl.textContent = data.humidity + " %";
  airEl.textContent = data.air_quality;
}

async function fetchHistory() {
  const res = await fetch(`${API_URL}/history`);
  const data = await res.json();

  const labels = data.map(d =>
    new Date(d.created_at).toLocaleTimeString()
  );

  tempHumChart.data.labels = labels;
  airChart.data.labels = labels;

  tempHumChart.data.datasets[0].data = data.map(d => d.temperature);
  tempHumChart.data.datasets[1].data = data.map(d => d.humidity);

  airChart.data.datasets[0].data = data.map(d => d.air_quality);

  tempHumChart.update();
  airChart.update();
}

setInterval(() => {
  fetchLatest();
  fetchHistory();
}, 3000);

fetchLatest();
fetchHistory();
