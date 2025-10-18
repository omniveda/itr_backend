import mysql from 'mysql2/promise';

const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Update as needed
  database: 'itr_system',
  port: 3306,
};

async function createCaTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ca (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        mobile_no VARCHAR(20) NOT NULL,
        isca BOOLEAN DEFAULT TRUE
      );
    `;
    await connection.execute(createTableSQL);
    console.log('ca table created or already exists.');
  } catch (error) {
    console.error('Error creating ca table:', error);
  } finally {
    await connection.end();
  }
}

createCaTable();
