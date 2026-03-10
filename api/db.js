const { Pool } = require('pg');

const getPool = () => {
  if (!global.__pgPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('Missing DATABASE_URL');
    }
    global.__pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 2,
    });
  }
  return global.__pgPool;
};

const query = async (text, params) => {
  const pool = getPool();
  return pool.query(text, params);
};

module.exports = { query };

