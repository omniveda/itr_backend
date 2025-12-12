import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function updateITRTableComment() {
  const connection = await mysql.createConnection(config);
  try {
    // Drop the ca_upload column
    // const dropColumnSQL = `
    //   ALTER TABLE itr DROP COLUMN ca_upload;
    // `;
    // await connection.execute(dropColumnSQL);
    // console.log('Dropped ca_upload column from ITR table.');

    // Add the three new columns
    const addColumnsSQL = `
      ALTER TABLE itr
      ADD COLUMN Comment VARCHAR(255);
    `;
    await connection.execute(addColumnsSQL);
    console.log('Added Comment columns to ITR table.');
  } catch (error) {
    console.error('Error updating ITR table for CA docs:', error);
  } finally {
    await connection.end();
  }
}

updateITRTableComment();
