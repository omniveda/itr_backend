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

async function addIssubadminToSubadminTable() {
  const connection = await mysql.createConnection(config);
  try {
    const alterTableSQL = `
      ALTER TABLE subadmin
      ADD COLUMN IF NOT EXISTS issubadmin BOOLEAN DEFAULT TRUE;
    `;
    await connection.execute(alterTableSQL);
    console.log('Added issubadmin column to subadmin table.');
  } catch (error) {
    console.error('Error adding issubadmin column:', error);
  } finally {
    await connection.end();
  }
}

addIssubadminToSubadminTable();
