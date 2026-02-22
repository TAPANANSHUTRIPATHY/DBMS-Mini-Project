const express = require('express');
const router = express.Router();
const controller = require('../controllers/sensorController-test');

router.post('/update', controller.insertData);

module.exports = router;