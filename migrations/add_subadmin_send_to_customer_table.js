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

async function addSubadminSendToCustomerTable() {
  const connection = await mysql.createConnection(config);
  try {
    const alterTableSQL = `
      ALTER TABLE customer
      ADD COLUMN subadmin_send BOOLEAN DEFAULT FALSE;
    `;
    await connection.execute(alterTableSQL);
    console.log('Added subadmin_send column to customer table.');
  } catch (error) {
    console.error('Error adding subadmin_send column:', error);
  } finally {
    await connection.end();
  }
}

addSubadminSendToCustomerTable();
