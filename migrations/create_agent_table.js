import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function createAgentTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS agent (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        father_name VARCHAR(255),
        mobile_no VARCHAR(20),
        mail_id VARCHAR(255),
        address TEXT,
        profile_photo VARCHAR(255),
        alternate_mobile_no VARCHAR(20),
        isagent VARCHAR(20) DEFAULT 'unverified'
      );
    `;
    await connection.execute(createTableSQL);
    console.log('Agent table created or already exists.');
  } catch (error) {
    console.error('Error creating agent table:', error);
  } finally {
    await connection.end();
  }
}

createAgentTable();
