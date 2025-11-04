import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function createPaymentTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS payment (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id INT NOT NULL,
        customer_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        paid BOOLEAN DEFAULT FALSE,
        payment_method VARCHAR(20) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agent(id),
        FOREIGN KEY (customer_id) REFERENCES customer(id)
      );
    `;
    await connection.execute(createTableSQL);
    console.log('Payment table created or already exists.');
  } catch (error) {
    console.error('Error creating payment table:', error);
  } finally {
    await connection.end();
  }
}

createPaymentTable();
