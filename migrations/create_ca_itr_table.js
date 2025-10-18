import mysql from 'mysql2/promise';

const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Update as needed
  database: 'itr_system',
  port: 3306,
};

async function createCaItrTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ca_itr (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        subadmin_id INT NOT NULL,
        agent_id INT NOT NULL,
        ca_id INT NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customer(id),
        FOREIGN KEY (subadmin_id) REFERENCES subadmin(id),
        FOREIGN KEY (agent_id) REFERENCES agent(id),
        FOREIGN KEY (ca_id) REFERENCES ca(id)
      );
    `;
    await connection.execute(createTableSQL);
    console.log('ca_itr table created or already exists.');
  } catch (error) {
    console.error('Error creating ca_itr table:', error);
  } finally {
    await connection.end();
  }
}

createCaItrTable();
