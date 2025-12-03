import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function addUniqueConstraintToPanNumber() {
  const connection = await mysql.createConnection(config);
  try {
    // Add unique constraint to pan_number column in customer table
    const alterTableSQL = `
      ALTER TABLE customer ADD CONSTRAINT unique_pan_number UNIQUE (pan_number);
    `;
    await connection.execute(alterTableSQL);
    console.log('Unique constraint added to pan_number in customer table.');
  } catch (error) {
    console.error('Error adding unique constraint to pan_number:', error);
  } finally {
    await connection.end();
  }
}

addUniqueConstraintToPanNumber();
