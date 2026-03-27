// this file just sets up the database connection and exports it
// we use a "Pool" instead of a single Client because a Pool can handle multiple queries at the same time
// which matters a lot when many users are on the dashboard at once

const { Pool } = require('pg');   // pg is the postgres driver for Node — allows us to run SQL queries
require('dotenv').config();        // loads variables from .env file into process.env (so DATABASE_URL works)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,  // the full postgres connection string is stored in .env (Supabase URL)
  ssl: {
    rejectUnauthorized: false  // supabase uses SSL but with a self-signed cert, this disables the cert check so the connection doesn't fail
  }
});

module.exports = pool;  // export so controllers can just require this and run queries