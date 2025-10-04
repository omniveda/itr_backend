import 'dotenv/config';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
};

let pool;

export async function initDb() {
  pool = await mysql.createPool(dbConfig);
  console.log('MySQL connection pool created');
}

export { pool };
