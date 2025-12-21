import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function updateCATable() {
  const connection = await mysql.createConnection(config);
  try {
    const alterTableSQL = `
      ALTER TABLE ca
      ADD COLUMN IF NOT EXISTS reject BOOLEAN DEFAULT true;
    `;
    await connection.execute(alterTableSQL);
    console.log('ca table updated with reject column.');
  } catch (error) {
    console.error('Error updating ca table:', error);
  } finally {
    await connection.end();
  }
}

updateCATable();
