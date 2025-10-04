import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function updateAgentTable() {
  const connection = await mysql.createConnection(config);
  try {
    const alterTableSQL = `
      ALTER TABLE agent
      ADD COLUMN IF NOT EXISTS isagent VARCHAR(20) DEFAULT 'unverified';
    `;
    await connection.execute(alterTableSQL);
    console.log('Agent table updated with isagent column.');
  } catch (error) {
    console.error('Error updating agent table:', error);
  } finally {
    await connection.end();
  }
}

updateAgentTable();
