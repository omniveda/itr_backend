import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function createSubadminPermissionAgentTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS subadmin_permission_agent (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subadmin_permissions_id INT NOT NULL,
        name TINYINT(1) DEFAULT 0,
        father_name TINYINT(1) DEFAULT 0,
        mobile_no TINYINT(1) DEFAULT 0,
        mail_id TINYINT(1) DEFAULT 0,
        address TINYINT(1) DEFAULT 0,
        profile_photo TINYINT(1) DEFAULT 0,
        alternate_mobile_no TINYINT(1) DEFAULT 0,
        password TINYINT(1) DEFAULT 0,
        wbalance TINYINT(1) DEFAULT 0,
        FOREIGN KEY (subadmin_permissions_id) REFERENCES subadmin_permissions(id) ON DELETE CASCADE
      );
    `;
    await connection.execute(createTableSQL);
    console.log('Subadmin permission agent table created or already exists.');
  } catch (error) {
    console.error('Error creating subadmin permission agent table:', error);
  } finally {
    await connection.end();
  }
}

createSubadminPermissionAgentTable();
