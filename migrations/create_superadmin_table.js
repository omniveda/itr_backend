import 'dotenv/config';
import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function createSuperadminTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS superadmin (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        issuperadmin BOOLEAN DEFAULT TRUE
      );
    `;
    await connection.execute(createTableSQL);
    console.log('Superadmin table created or already exists.');
  } catch (error) {
    console.error('Error creating superadmin table:', error);
  } finally {
    await connection.end();
  }
}

createSuperadminTable();
