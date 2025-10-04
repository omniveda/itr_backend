import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function createITRTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS itr (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        father_name VARCHAR(255),
        dob DATE,
        pan_number VARCHAR(10),
        adhar_number VARCHAR(12),
        account_number VARCHAR(20),
        bank_name VARCHAR(255),
        ifsc_code VARCHAR(11),
        tds_details TEXT,
        itr_password VARCHAR(255),
        asst_year VARCHAR(10),
        income_salary_business VARCHAR(255),
        mobile_no_adhar_registered VARCHAR(20),
        mail_id VARCHAR(255),
        income_slab ENUM('0 TO 3 LAC', '3 TO 5 LAC', '5 TO 7 LAC', '7 TO 12 LAC', '12 LAC ABOVE'),
        comment_box TEXT,
        attachment_1 VARCHAR(255),
        attachment_2 VARCHAR(255),
        attachment_3 VARCHAR(255),
        attachment_4 VARCHAR(255),
        attachment_5 VARCHAR(255),
        agent_id INT,
        customer_id INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agent(id),
        FOREIGN KEY (customer_id) REFERENCES customer(id)
      );
    `;
    await connection.execute(createTableSQL);
    console.log('ITR table created or already exists.');
  } catch (error) {
    console.error('Error creating ITR table:', error);
  } finally {
    await connection.end();
  }
}

createITRTable();
