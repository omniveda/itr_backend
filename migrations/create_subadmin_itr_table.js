import 'dotenv/config';
import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
};

async function createSubadminITRTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS subadmin_itr (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        agent_id INT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE CASCADE
      );
    `;
    await connection.execute(createTableSQL);
    console.log('Subadmin ITR table created or already exists.');
  } catch (error) {
    console.error('Error creating subadmin_itr table:', error);
  } finally {
    await connection.end();
  }
}

createSubadminITRTable();
