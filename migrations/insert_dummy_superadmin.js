import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function insertDummySuperadmin() {
  const connection = await mysql.createConnection(config);
  try {
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);

    const insertSQL = `
      INSERT INTO superadmin (username, password, issuperadmin)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
      password = VALUES(password),
      issuperadmin = VALUES(issuperadmin);
    `;

    await connection.execute(insertSQL, ['superadmin', hashedPassword, true]);
    console.log('Dummy superadmin inserted or updated successfully.');
    console.log('Username: superadmin');
    console.log('Password: admin123');
  } catch (error) {
    console.error('Error inserting dummy superadmin:', error);
  } finally {
    await connection.end();
  }
}

insertDummySuperadmin();
