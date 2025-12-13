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
      CREATE TABLE itr_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  itr_id INT NOT NULL,
  agent_id INT NOT NULL,
  wallet_transaction_id INT,
  amount DECIMAL(10, 2) NOT NULL,
  payment_status ENUM('pending', 'completed', 'failed') DEFAULT 'completed',
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (itr_id) REFERENCES itr(id),
  FOREIGN KEY (agent_id) REFERENCES agent(id),
  FOREIGN KEY (wallet_transaction_id) REFERENCES wallet_transactions(id)
);
    `;
    await connection.execute(createTableSQL);
    console.log('itr_payments table created or already exists.');
  } catch (error) {
    console.error('Error creating messages table:', error);
  } finally {
    await connection.end();
  }
}

createMessagesTable();
