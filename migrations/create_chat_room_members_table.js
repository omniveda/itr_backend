import mysql from 'mysql2/promise';

const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'itr_system',
  port: 3306,
};

async function createChatRoomMembersTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS chat_room_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        user_role ENUM('subadmin','agent','ca','superadmin') NOT NULL,
        display_name VARCHAR(255),
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
      );
    `;
    await connection.execute(createTableSQL);
    console.log('chat_room_members table created or already exists.');
  } catch (error) {
    console.error('Error creating chat_room_members table:', error);
  } finally {
    await connection.end();
  }
}

createChatRoomMembersTable();
