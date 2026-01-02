import { pool, initDb } from '../db.js';

async function createItrCustomerTable() {
    await initDb();
    const query = `
    CREATE TABLE IF NOT EXISTS itr_customer (
      id INT AUTO_INCREMENT PRIMARY KEY,
      itr_id INT NOT NULL,
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
      attachments_6 VARCHAR(255),
      file_charge DECIMAL(10,2),
      income_slab VARCHAR(50),
      comment_box TEXT,
      customer_type VARCHAR(10),
      agent_id INT,
      snapshot_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (itr_id) REFERENCES itr(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agent(id)
    );
  `;

    try {
        await pool.query(query);
        console.log('itr_customer table created successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error creating itr_customer table:', error);
        process.exit(1);
    }
}

createItrCustomerTable();
