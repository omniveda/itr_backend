import 'dotenv/config';
import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function createSubadminPermissionsTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS subadmin_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subadmin_id INT NOT NULL,
        permission VARCHAR(255) NOT NULL,
        FOREIGN KEY (subadmin_id) REFERENCES subadmin(id) ON DELETE CASCADE,
        UNIQUE KEY unique_subadmin_permission (subadmin_id, permission)
      );
    `;
    await connection.execute(createTableSQL);
    console.log('Subadmin permissions table created or already exists.');
  } catch (error) {
    console.error('Error creating subadmin permissions table:', error);
  } finally {
    await connection.end();
  }
}

createSubadminPermissionsTable();
