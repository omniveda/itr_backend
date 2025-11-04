import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function addStatusToITRTable() {
  const connection = await mysql.createConnection(config);
  try {
    const alterTableSQL = `
      ALTER TABLE itr
      ADD COLUMN status TINYINT DEFAULT 0;
    `;
    await connection.execute(alterTableSQL);
    console.log('Status column added to ITR table.');
  } catch (error) {
    console.error('Error adding status column to ITR table:', error);
  } finally {
    await connection.end();
  }
}

addStatusToITRTable();
