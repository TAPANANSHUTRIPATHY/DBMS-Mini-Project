const API_URL = "http://localhost:5000/api";

const tempEl = document.getElementById("temp");
const humEl = document.getElementById("hum");
const airEl = document.getElementById("air");

const ctx = document.getElementById('chart').getContext('2d');

const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      {
        label: 'Temperature',
        borderColor: 'red',
        data: [],
        fill: false
      },
      {
        label: 'Air Quality',
        borderColor: 'lime',
        data: [],
        fill: false
      }
    ]
  },
  options: {
    responsive: true
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

  chart.data.labels = data.map(d =>
    new Date(d.created_at).toLocaleTimeString()
  );

  chart.data.datasets[0].data = data.map(d => d.temperature);
  chart.data.datasets[1].data = data.map(d => d.air_quality);

  chart.update();
}

setInterval(() => {
  fetchLatest();
  fetchHistory();
}, 3000);

fetchLatest();
fetchHistory();
