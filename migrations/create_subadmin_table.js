import 'dotenv/config';
import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
};

async function createSubadminTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS subadmin (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        issubadmin BOOLEAN DEFAULT TRUE
      );
    `;
    await connection.execute(createTableSQL);
    console.log('Subadmin table created or already exists.');
  } catch (error) {
    console.error('Error creating subadmin table:', error);
  } finally {
    await connection.end();
  }
}

createSubadminTable();
