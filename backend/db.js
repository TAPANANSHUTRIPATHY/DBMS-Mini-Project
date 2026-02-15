const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'TAPANANSHU',  // change if different
  database: 'iotdb',
  port: 5432,
});

module.exports = pool;
