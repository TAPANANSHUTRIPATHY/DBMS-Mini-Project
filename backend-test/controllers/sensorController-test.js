const pool = require('../db-test');

exports.insertData = async (req, res) => {
  try {
    const { temperature, humidity, air_quality } = req.body;

    await pool.query(
      'INSERT INTO sensor_test_data (temperature, humidity, air_quality) VALUES ($1, $2, $3)',
      [temperature, humidity, air_quality]
    );

    res.json({ message: "Data inserted successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};