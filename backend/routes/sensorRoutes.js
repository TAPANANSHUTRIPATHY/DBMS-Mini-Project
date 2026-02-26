const express = require('express');
const router = express.Router();
const controller = require('../controllers/sensorController');

router.post('/update', controller.insertSensorData);
router.get('/latest', controller.getLatestData);
router.get('/history', controller.getHistory);

module.exports = router;