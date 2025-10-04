import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function createCustomerTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS customer (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        father_name VARCHAR(255),
        dob DATE,
        pan_number VARCHAR(10),
        adhar_number VARCHAR(12),
        account_number VARCHAR(20),
        bank_name VARCHAR(255),
        ifsc_code VARCHAR(11),
        tds_amount DECIMAL(10,2),
        itr_password VARCHAR(255),
        asst_year_3yr VARCHAR(10),
        income_type VARCHAR(20),
        mobile_no VARCHAR(20),
        mail_id VARCHAR(255),
        filling_type VARCHAR(10),
        last_ay_income DECIMAL(15,2),
        profile_photo VARCHAR(255),
        user_id VARCHAR(255),
        password VARCHAR(255),
        attachments_1 VARCHAR(255),
        attachments_2 VARCHAR(255),
        attachments_3 VARCHAR(255),
        attachments_4 VARCHAR(255),
        attachments_5 VARCHAR(255),
        file_charge DECIMAL(10,2),
        apply_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        income_slab VARCHAR(50),
        comment_box TEXT,
        customer_type VARCHAR(10),
        agent_id INT,
        FOREIGN KEY (agent_id) REFERENCES agent(id)
      );
    `;
    await connection.execute(createTableSQL);
    console.log('Customer table created or already exists.');
  } catch (error) {
    console.error('Error creating customer table:', error);
  } finally {
    await connection.end();
  }
}

createCustomerTable();
