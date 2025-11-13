import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function addRejectedToITRStatus() {
  const connection = await mysql.createConnection(config);
  try {
    const alterStatusSQL = `
      ALTER TABLE itr MODIFY COLUMN status ENUM('Pending', 'In Progress', 'Completed', 'Rejected') DEFAULT 'Pending';
    `;
    await connection.execute(alterStatusSQL);
    console.log('Added "Rejected" to status ENUM in ITR table.');
  } catch (error) {
    console.error('Error adding "Rejected" to status ENUM in ITR table:', error);
  } finally {
    await connection.end();
  }
}

addRejectedToITRStatus();
