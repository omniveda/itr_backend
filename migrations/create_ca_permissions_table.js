import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function createCaPermissionsTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ca_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ca_id INT NOT NULL,
        permission VARCHAR(255) NOT NULL,
        FOREIGN KEY (ca_id) REFERENCES ca(id) ON DELETE CASCADE,
        UNIQUE KEY unique_ca_permission (ca_id, permission)
      );
    `;
    await connection.execute(createTableSQL);
    console.log('CA permissions table created or already exists.');
  } catch (error) {
    console.error('Error creating CA permissions table:', error);
  } finally {
    await connection.end();
  }
}

createCaPermissionsTable();
