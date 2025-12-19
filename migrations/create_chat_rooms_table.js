import mysql from 'mysql2/promise';

const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'itr_system',
  port: 3306,
};

async function createChatRoomsTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subadmin_id INT NOT NULL,
        created_by INT NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await connection.execute(createTableSQL);
    console.log('chat_rooms table created or already exists.');
  } catch (error) {
    console.error('Error creating chat_rooms table:', error);
  } finally {
    await connection.end();
  }
}

createChatRoomsTable();
