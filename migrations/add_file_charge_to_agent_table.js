import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function addFileChargeToAgentTable() {
  const connection = await mysql.createConnection(config);
  try {
    const alterTableSQL = `
      ALTER TABLE agent
      ADD COLUMN file_charge INT;
    `;
    await connection.execute(alterTableSQL);
    console.log('file_charge column added to agent table.');
  } catch (error) {
    console.error('Error adding file_charge column to agent table:', error);
  } finally {
    await connection.end();
  }
}

addFileChargeToAgentTable();
