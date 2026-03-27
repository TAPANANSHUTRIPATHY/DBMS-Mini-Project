// this is the main entry point for the backend
// basically this file starts the express server and ties everything together

const express = require('express');  // express is the framework we're using to build the REST API
const cors = require('cors');         // cors lets the frontend (running on a different port/domain) talk to this server, without it the browser blocks the requests

const sensorRoutes = require('./routes/sensorRoutes');  // all our /api routes are defined separately in this file

const app = express();  // create the actual app instance

// these two are middleware — they run on every request before our route handlers
app.use(cors());          // allow cross-origin requests (frontend is at a different URL than backend)
app.use(express.json());  // parse incoming request body as JSON so we can read req.body in our controllers

// register all sensor related routes under /api prefix
// so POST /api/update, GET /api/latest, GET /api/history all work from here
app.use('/api', sensorRoutes);

// start the server on port 5000
app.listen(5000, () => {
  console.log("Server running on port 5000");
});