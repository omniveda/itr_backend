import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Update as needed
  database: 'itr_system',
  port: 3306,
};

async function updateCAPassword() {
  const connection = await mysql.createConnection(config);
  try {
    // Hash the password
    const plainPassword = '12345678'; // The password you want to use
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    
    // Update the CA's password
    const updateSQL = `
      UPDATE ca 
      SET password = ? 
      WHERE username = ?;
    `;
    
    await connection.execute(updateSQL, [hashedPassword, 'ca1234']);
    console.log('Successfully updated CA password');
  } catch (error) {
    console.error('Error updating CA password:', error);
  } finally {
    await connection.end();
  }
}

updateCAPassword();