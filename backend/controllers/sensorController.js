// this file contains all the actual logic for the sensor-related API endpoints
// think of controllers as the "brain" — routes just say what URL goes where, controllers do the actual work

const pool = require('../db');  // import the db connection pool we set up in db.js

// POST /api/update
// ESP32 sends temperature, humidity, and air_quality data to this endpoint every few seconds
// we just take those values and insert them into the sensor_data table in Supabase
exports.insertSensorData = async (req, res) => {
  try {
    const { temperature, humidity, air_quality } = req.body;  // destructure the three values from the request body

    // insert the reading into the DB — $1, $2, $3 are parameterized placeholders (prevents SQL injection)
    // created_at is automatically filled by the DB default (current timestamp)
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

// GET /api/latest
// frontend polls this every 1 second to get the most recent sensor reading
// ORDER BY created_at DESC LIMIT 1 means just grab the newest row
exports.getLatestData = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 1'
    );

    res.json(result.rows[0]);  // rows[0] is just the first (and only) result

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/history
// this is used by the historical dashboard to load all readings for a specific date
// if ?date=YYYY-MM-DD is passed in the query, we filter by that day in IST timezone
// if no date is passed we return everything (sorted oldest to newest)
exports.getHistory = async (req, res) => {
  try {
    let result;

    if (req.query.date) {
      // filter by the full 24-hour window for the given date in IST (Asia/Kolkata = UTC+5:30)
      // we have to do this timezone conversion in SQL because the DB stores timestamps in UTC
      // without the AT TIME ZONE conversion, readings between 12AM and 5:30AM IST would be missed
      result = await pool.query(
        `SELECT * FROM sensor_data
         WHERE created_at >= ($1::date AT TIME ZONE 'Asia/Kolkata')
           AND created_at <  (($1::date + interval '1 day') AT TIME ZONE 'Asia/Kolkata')
         ORDER BY created_at ASC`,
        [req.query.date]
      );
    } else {
      // no date filter — return all records sorted by time (used for the forecast/7-day view)
      result = await pool.query(
        `SELECT * FROM sensor_data ORDER BY created_at ASC`
      );
    }

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};