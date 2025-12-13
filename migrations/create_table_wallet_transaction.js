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
      CREATE TABLE wallet_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  wallet_id INT NOT NULL,
  transaction_type ENUM('credit', 'debit') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  reference_type ENUM('recharge', 'itr_payment') NOT NULL,
  reference_id INT,
  description TEXT,
  performed_by INT NOT NULL,
  status ENUM('pending', 'completed', 'failed', 'reversed') DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id),
  FOREIGN KEY (performed_by) REFERENCES agent(id),
  INDEX idx_wallet_created (wallet_id, created_at)
);
    `;
    await connection.execute(createTableSQL);
    console.log('wallet_transactions table created or already exists.');
  } catch (error) {
    console.error('Error creating messages table:', error);
  } finally {
    await connection.end();
  }
}

createMessagesTable();
