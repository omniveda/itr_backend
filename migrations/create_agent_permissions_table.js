import 'dotenv/config';
import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'itr_system',
  port: process.env.DB_PORT || 3306,
};

async function createAgentPermissionsTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS agent_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id INT NOT NULL,
        permissions JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE CASCADE,
        UNIQUE KEY unique_agent_permissions (agent_id)
      );
    `;
    await connection.execute(createTableSQL);
    console.log('Agent permissions table created or already exists.');
  } catch (error) {
    console.error('Error creating agent permissions table:', error);
  } finally {
    await connection.end();
  }
}

createAgentPermissionsTable();
