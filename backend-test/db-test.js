const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'iot-test-env',
  password: 'TAPANANSHU',
  port: 5432,
});

module.exports = pool;