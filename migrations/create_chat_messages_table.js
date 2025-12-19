import mysql from 'mysql2/promise';

const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'itr_system',
  port: 3306,
};

async function createChatMessagesTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        sender_id INT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
      );
    `;
    await connection.execute(createTableSQL);
    console.log('chat_messages table created or already exists.');
  } catch (error) {
    console.error('Error creating chat_messages table:', error);
  } finally {
    await connection.end();
  }
}

createChatMessagesTable();
