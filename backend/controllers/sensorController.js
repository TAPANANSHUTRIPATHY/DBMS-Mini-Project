const pool = require('../db');

exports.insertSensorData = async (req, res) => {
  try {
    const { temperature, humidity, air_quality } = req.body;

    await pool.query(
      'INSERT INTO sensor_data (temperature, humidity, air_quality) VALUES ($1, $2, $3)',
      [temperature, humidity, air_quality]
    );

    res.status(200).json({ message: "Data stored successfully" });

  } catch (err) {
    console.error("DB ERROR:", err);
    res.status(500).json({ error: "Database error" });
  }
};

exports.getLatestData = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 1'
    );

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    let result;

    if (req.query.date) {
      // Filter by UTC date — matches exactly what Neon console shows per date
      result = await pool.query(
        `SELECT * FROM sensor_data
         WHERE created_at::date = $1::date
         ORDER BY created_at ASC`,
        [req.query.date]
      );
    } else {
      // No date — return all records (sorted)
      result = await pool.query(
        `SELECT * FROM sensor_data ORDER BY created_at ASC`
      );
    }

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};