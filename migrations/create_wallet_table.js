import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function createMessagesTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE wallets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  agent_id INT NOT NULL,
  balance DECIMAL(10, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'INR',
  status ENUM('active', 'suspended', 'closed') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agent(id),
  UNIQUE KEY unique_agent_wallet (agent_id)
);
    `;
    await connection.execute(createTableSQL);
    console.log('Wallet table created or already exists.');
  } catch (error) {
    console.error('Error creating messages table:', error);
  } finally {
    await connection.end();
  }
}

createMessagesTable();
