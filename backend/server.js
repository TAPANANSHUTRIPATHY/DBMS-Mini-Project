const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/update', async (req, res) => {
  const { temperature, humidity, air_quality } = req.body;

  try {
    await pool.query(
      'INSERT INTO sensor_data (temperature, humidity, air_quality) VALUES ($1, $2, $3)',
      [temperature, humidity, air_quality]
    );
    res.json({ message: "Data inserted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/latest', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 1'
  );
  res.json(result.rows[0]);
});

app.get('/api/history', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 20'
  );
  res.json(result.rows);
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
