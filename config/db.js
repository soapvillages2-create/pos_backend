require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'loyalcloud_db',
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    return;
  }
  console.log('✅ Database connected successfully!');
  release();
});

module.exports = pool;
