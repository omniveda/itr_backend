import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function addNewColumnsToPaymentTable() {
  const connection = await mysql.createConnection(config);
  try {
    const alterTableSQL = `
      ALTER TABLE payment
      ADD COLUMN asst_year VARCHAR(10);
    `;
    await connection.execute(alterTableSQL);
    console.log('New columns added to Payment table.');
  } catch (error) {
    console.error('Error adding new columns to Payment table:', error);
  } finally {
    await connection.end();
  }
}

addNewColumnsToPaymentTable();
