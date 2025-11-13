import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function alterCaITRTable() {
  const connection = await mysql.createConnection(config);
  try {
    // Make subadmin_id and agent_id nullable
    await connection.execute('ALTER TABLE ca_itr MODIFY COLUMN subadmin_id INT NULL');
    await connection.execute('ALTER TABLE ca_itr MODIFY COLUMN agent_id INT NULL');

    console.log('CA ITR table altered successfully to allow NULL for subadmin_id and agent_id.');
  } catch (error) {
    console.error('Error altering ca_itr table:', error);
  } finally {
    await connection.end();
  }
}

alterCaITRTable();
