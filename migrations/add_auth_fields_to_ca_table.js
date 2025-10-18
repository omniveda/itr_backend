import mysql from 'mysql2/promise';

const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Update as needed
  database: 'itr_system',
  port: 3306,
};

async function addAuthFieldsToCaTable() {
  const connection = await mysql.createConnection(config);
  try {
    const addFieldsSQL = `
      ALTER TABLE ca
      ADD COLUMN username VARCHAR(255) NOT NULL UNIQUE,
      ADD COLUMN password VARCHAR(255) NOT NULL;
    `;
    await connection.execute(addFieldsSQL);
    console.log('Added username and password fields to ca table.');
  } catch (error) {
    console.error('Error adding fields to ca table:', error);
  } finally {
    await connection.end();
  }
}

addAuthFieldsToCaTable();