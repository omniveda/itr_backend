import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function updateCATableStructure() {
  const connection = await mysql.createConnection(config);
  try {
    // Drop foreign key constraints first
    // const dropFKSQL = `
    //   ALTER TABLE ca_itr
    //   DROP FOREIGN KEY ca_itr_ibfk_2,
    //   DROP FOREIGN KEY ca_itr_ibfk_3
    // `;
    // await connection.execute(dropFKSQL);
    // console.log('Dropped foreign key constraints for subadmin_id and agent_id.');

    // Drop redundant columns
    const dropColumnsSQL = `
      ALTER TABLE ca_itr
       DROP COLUMN date
    `;
    await connection.execute(dropColumnsSQL);
    console.log('Dropped subadmin_id and agent_id columns from ca_itr table.');

    // Ensure necessary columns exist
    // customer_id, asst_year, status, agent_id, agentedit, created_at, updated_at are already there
    // But let's modify status to ENUM if needed
    // const modifyStatusSQL = `
    //   ALTER TABLE itr MODIFY COLUMN status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending';
    // `;
    // await connection.execute(modifyStatusSQL);
    // console.log('Modified status column in ITR table.');
  } catch (error) {
    console.error('Error updating ITR table structure:', error);
  } finally {
    await connection.end();
  }
}

updateCATableStructure();
