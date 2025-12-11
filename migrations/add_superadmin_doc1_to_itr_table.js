import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function addSuperadminDoc1ToITRTable() {
  const connection = await mysql.createConnection(config);
  try {
    const alterTableSQL = `
      ALTER TABLE itr ADD COLUMN Superadmin_doc1 VARCHAR(255);
    `;
    await connection.execute(alterTableSQL);
    console.log('Added Superadmin_doc1 column to ITR table.');
  } catch (error) {
    console.error('Error adding Superadmin_doc1 column:', error);
  } finally {
    await connection.end();
  }
}

addSuperadminDoc1ToITRTable();
