import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function updateITRTableStructure() {
  const connection = await mysql.createConnection(config);
  try {
    // Drop redundant columns
    const dropColumnsSQL = `
      ALTER TABLE itr
      DROP COLUMN name,
      DROP COLUMN father_name,
      DROP COLUMN dob,
      DROP COLUMN pan_number,
      DROP COLUMN adhar_number,
      DROP COLUMN account_number,
      DROP COLUMN bank_name,
      DROP COLUMN ifsc_code,
      DROP COLUMN tds_details,
      DROP COLUMN itr_password,
      DROP COLUMN income_salary_business,
      DROP COLUMN mobile_no_adhar_registered,
      DROP COLUMN mail_id,
      DROP COLUMN income_slab,
      DROP COLUMN comment_box,
      DROP COLUMN attachment_1,
      DROP COLUMN attachment_2,
      DROP COLUMN attachment_3,
      DROP COLUMN attachment_4,
      DROP COLUMN attachment_5;
    `;
    await connection.execute(dropColumnsSQL);
    console.log('Dropped redundant columns from ITR table.');

    // Ensure necessary columns exist
    // customer_id, asst_year, status, agent_id, agentedit, created_at, updated_at are already there
    // But let's modify status to ENUM if needed
    const modifyStatusSQL = `
      ALTER TABLE itr MODIFY COLUMN status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending';
    `;
    await connection.execute(modifyStatusSQL);
    console.log('Modified status column in ITR table.');
  } catch (error) {
    console.error('Error updating ITR table structure:', error);
  } finally {
    await connection.end();
  }
}

updateITRTableStructure();
