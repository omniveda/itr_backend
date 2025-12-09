import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function addSubadminDocsToITRTable() {
  const connection = await mysql.createConnection(config);
  try {
    const alterTableSQL = `
      ALTER TABLE itr
      ADD COLUMN Subadmin_doc1 VARCHAR(255),
      ADD COLUMN Subadmin_doc2 VARCHAR(255);
    `;
    await connection.execute(alterTableSQL);
    console.log('Added Subadmin_doc1 and Subadmin_doc2 columns to ITR table.');
  } catch (error) {
    console.error('Error adding Subadmin_doc columns to ITR table:', error);
  } finally {
    await connection.end();
  }
}

addSubadminDocsToITRTable();
