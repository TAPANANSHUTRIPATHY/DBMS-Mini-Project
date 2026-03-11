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
      // Calculate exactly a 24-hour block based on IST (so 9 PM local aligns correctly without losing 12 AM ➜ 5:30 AM data)
      result = await pool.query(
        `SELECT * FROM sensor_data
         WHERE created_at >= ($1::date AT TIME ZONE 'Asia/Kolkata')
           AND created_at <  (($1::date + interval '1 day') AT TIME ZONE 'Asia/Kolkata')
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