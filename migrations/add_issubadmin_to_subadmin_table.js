import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
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
