const mysql = require('mysql2');
require('dotenv').config();

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 20984,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.getConnection((err, connection) => {
  if (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('MySQL: connection lost.');
    } else if (err.code === 'ER_CON_COUNT_ERROR') {
      console.error('MySQL: too many connections.');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('MySQL: connection refused. Make sure MySQL is running.');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error(`MySQL: database '${process.env.DB_NAME}' not found.`);
    } else {
      console.error('MySQL connection error:', err.message);
    }
  } else {
    console.log('MySQL connected.');
    connection.release();
  }
});

const promisePool = pool.promise();

module.exports = promisePool;
