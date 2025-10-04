import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function addPasswordToAgentTable() {
  const connection = await mysql.createConnection(config);
  try {
    const alterTableSQL = `
      ALTER TABLE agent
      ADD COLUMN IF NOT EXISTS password VARCHAR(255) NOT NULL;
    `;
    await connection.execute(alterTableSQL);
    console.log('Agent table updated with password column.');
  } catch (error) {
    console.error('Error updating agent table:', error);
  } finally {
    await connection.end();
  }
}

addPasswordToAgentTable();
