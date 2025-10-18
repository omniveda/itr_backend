import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function addAgentEditToITRTable() {
  const connection = await mysql.createConnection(config);
  try { 
    const alterTableSQL = `
      ALTER TABLE itr ADD COLUMN agentedit BOOLEAN DEFAULT FALSE;
    `;
    await connection.execute(alterTableSQL);
    console.log('Added agentedit column to ITR table.');
  } catch (error) {
    console.error('Error adding agentedit column:', error);
  } finally {
    await connection.end();
  }
}

addAgentEditToITRTable();
