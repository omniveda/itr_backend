import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function createCaCustomerPermissionTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ca_customer_permission (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ca_permissions_id INT NOT NULL,
        name TINYINT(1) DEFAULT 0,
        father_name TINYINT(1) DEFAULT 0,
        dob TINYINT(1) DEFAULT 0,
        pan_number TINYINT(1) DEFAULT 0,
        adhar_number TINYINT(1) DEFAULT 0,
        account_number TINYINT(1) DEFAULT 0,
        bank_name TINYINT(1) DEFAULT 0,
        ifsc_code TINYINT(1) DEFAULT 0,
        tds_amount TINYINT(1) DEFAULT 0,
        itr_password TINYINT(1) DEFAULT 0,
        asst_year_3yr TINYINT(1) DEFAULT 0,
        income_type TINYINT(1) DEFAULT 0,
        mobile_no TINYINT(1) DEFAULT 0,
        mail_id TINYINT(1) DEFAULT 0,
        filling_type TINYINT(1) DEFAULT 0,
        last_ay_income TINYINT(1) DEFAULT 0,
        profile_photo TINYINT(1) DEFAULT 0,
        user_id TINYINT(1) DEFAULT 0,
        password TINYINT(1) DEFAULT 0,
        attachments_1 TINYINT(1) DEFAULT 0,
        attachments_2 TINYINT(1) DEFAULT 0,
        attachments_3 TINYINT(1) DEFAULT 0,
        attachments_4 TINYINT(1) DEFAULT 0,
        attachments_5 TINYINT(1) DEFAULT 0,
        file_charge TINYINT(1) DEFAULT 0,
        apply_date TINYINT(1) DEFAULT 0,
        updated_date TINYINT(1) DEFAULT 0,
        income_slab TINYINT(1) DEFAULT 0,
        comment_box TINYINT(1) DEFAULT 0,
        customer_type TINYINT(1) DEFAULT 0,
        FOREIGN KEY (ca_permissions_id) REFERENCES ca_permissions(id) ON DELETE CASCADE
      );
    `;
    await connection.execute(createTableSQL);
    console.log('CA customer permission table created or already exists.');
  } catch (error) {
    console.error('Error creating CA customer permission table:', error);
  } finally {
    await connection.end();
  }
}

createCaCustomerPermissionTable();
