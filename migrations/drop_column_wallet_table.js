import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function removeColumnsFromCustomerTable() {
  const connection = await mysql.createConnection(config);
  try {
    const alterTableSQL = `
      ALTER TABLE wallets
      DROP COLUMN currency;
    `;
    await connection.execute(alterTableSQL);
    console.log('Columns removed from wallets table.');
  } catch (error) {
    console.error('Error removing columns from customer table:', error);
  } finally {
    await connection.end();
  }
}

removeColumnsFromCustomerTable();
