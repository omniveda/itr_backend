import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function addNewColumnsToITRTable() {
  const connection = await mysql.createConnection(config);
  try {
    const alterTableSQL = `
      ALTER TABLE itr
      ADD COLUMN subadmin_send BOOLEAN DEFAULT FALSE,
      ADD COLUMN ca_send BOOLEAN DEFAULT FALSE,
      ADD COLUMN ca_id INT,
      ADD COLUMN superadmin_send BOOLEAN DEFAULT FALSE,
      ADD COLUMN otp_check BOOLEAN DEFAULT FALSE;
    `;
    await connection.execute(alterTableSQL);
    console.log('New columns added to ITR table.');
  } catch (error) {
    console.error('Error adding new columns to ITR table:', error);
  } finally {
    await connection.end();
  }
}

addNewColumnsToITRTable();
