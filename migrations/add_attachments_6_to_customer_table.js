import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function addAttachments6ToCustomerTable() {
  const connection = await mysql.createConnection(config);
  try {
    const alterTableSQL = `
      ALTER TABLE customer
      ADD COLUMN attachments_6 VARCHAR(255);
    `;
    await connection.execute(alterTableSQL);
    console.log('attachments_6 column added to customer table.');
  } catch (error) {
    console.error('Error adding attachments_6 column to customer table:', error);
  } finally {
    await connection.end();
  }
}

addAttachments6ToCustomerTable();
