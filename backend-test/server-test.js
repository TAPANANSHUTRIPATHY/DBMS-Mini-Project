const express = require('express');
const cors = require('cors');

const sensorRoutes = require('./routes/sensorRoutes-test');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', sensorRoutes);

const PORT = 6000;

app.listen(PORT, () => {
  console.log(`TEST Backend running on port ${PORT}`);
});