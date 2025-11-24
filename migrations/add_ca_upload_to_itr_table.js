import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function addCaUploadToITRTable() {
  const connection = await mysql.createConnection(config);
  try {
    const alterTableSQL = `
      ALTER TABLE itr ADD COLUMN ca_upload VARCHAR(255);
    `;
    await connection.execute(alterTableSQL);
    console.log('Added ca_upload column to ITR table.');
  } catch (error) {
    console.error('Error adding ca_upload column:', error);
  } finally {
    await connection.end();
  }
}

addCaUploadToITRTable();
