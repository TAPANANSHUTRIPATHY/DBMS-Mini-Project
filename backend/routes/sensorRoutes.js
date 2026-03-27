// this file maps URL paths to the controller functions
// express Router lets us define routes in a separate file and then mount them in server.js

const express = require('express');
const router = express.Router();
const controller = require('../controllers/sensorController');  // import the actual logic

// POST /api/update → ESP32 uses this to push new sensor readings into the database
router.post('/update', controller.insertSensorData);

// GET /api/latest → frontend polls this every 1 second to show live temperature, humidity, AQI
router.get('/latest', controller.getLatestData);

// GET /api/history → used by the historical dashboard to fetch all readings for a given date
// accepts optional ?date=YYYY-MM-DD query parameter
router.get('/history', controller.getHistory);

module.exports = router;  // export so server.js can use it with app.use('/api', sensorRoutes)