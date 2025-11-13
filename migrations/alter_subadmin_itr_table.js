import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function alterSubadminITRTable() {
  const connection = await mysql.createConnection(config);
  try {
    // Drop foreign key constraints first
    await connection.execute('ALTER TABLE subadmin_itr DROP FOREIGN KEY subadmin_itr_ibfk_2');
    await connection.execute('ALTER TABLE subadmin_itr DROP COLUMN agent_id');
    await connection.execute('ALTER TABLE subadmin_itr DROP COLUMN sent_at');

    // Add subadmin_id column
    await connection.execute('ALTER TABLE subadmin_itr ADD COLUMN subadmin_id INT NOT NULL AFTER customer_id');

    // Add foreign key for subadmin_id
    await connection.execute('ALTER TABLE subadmin_itr ADD CONSTRAINT fk_subadmin_id FOREIGN KEY (subadmin_id) REFERENCES subadmin(id) ON DELETE CASCADE');

    console.log('Subadmin ITR table altered successfully.');
  } catch (error) {
    console.error('Error altering subadmin_itr table:', error);
  } finally {
    await connection.end();
  }
}

alterSubadminITRTable();
