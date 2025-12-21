import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function updateSubadminTable() {
  const connection = await mysql.createConnection(config);
  try {
    const alterTableSQL = `
      ALTER TABLE subadmin
      ADD COLUMN IF NOT EXISTS isdownload VARCHAR(20) DEFAULT 'unverified';
    `;
    await connection.execute(alterTableSQL);
    console.log('subadmin table updated with isdownload column.');
  } catch (error) {
    console.error('Error updating subadmin table:', error);
  } finally {
    await connection.end();
  }
}

updateSubadminTable();
