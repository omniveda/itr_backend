import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function createCustomerFormFieldsTable() {
  const connection = await mysql.createConnection(config);
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS customer_form_fields (
        id INT AUTO_INCREMENT PRIMARY KEY,
        field_name VARCHAR(255) NOT NULL UNIQUE,
        field_label VARCHAR(255) NOT NULL,
        field_type VARCHAR(50) NOT NULL DEFAULT 'text',
        is_required BOOLEAN DEFAULT FALSE,
        is_recommended BOOLEAN DEFAULT FALSE,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `;
    await connection.execute(createTableSQL);
    console.log('Customer form fields table created or already exists.');

    // Insert default fields based on customer table
    const insertFieldsSQL = `
      INSERT IGNORE INTO customer_form_fields (field_name, field_label, field_type, is_required, is_recommended, display_order) VALUES
      ('name', 'Name', 'text', true, false, 1),
      ('father_name', 'Father Name', 'text', false, true, 2),
      ('dob', 'Date of Birth', 'date', false, true, 3),
      ('pan_number', 'PAN Number', 'text', true, false, 4),
      ('adhar_number', 'Aadhaar Number', 'text', false, true, 5),
      ('account_number', 'Account Number', 'text', false, true, 6),
      ('bank_name', 'Bank Name', 'text', false, true, 7),
      ('ifsc_code', 'IFSC Code', 'text', false, true, 8),
      ('tds_amount', 'TDS Amount', 'number', false, false, 9),
      ('itr_password', 'ITR Password', 'password', false, true, 10),
      ('asst_year_3yr', 'Assessment Year (3yr)', 'text', false, true, 11),
      ('income_type', 'Income Type', 'select', false, true, 12),
      ('mobile_no', 'Mobile Number', 'tel', true, false, 13),
      ('mail_id', 'Email ID', 'email', false, true, 14),
      ('filling_type', 'Filling Type', 'select', false, true, 15),
      ('last_ay_income', 'Last A.Y Income', 'number', false, true, 16),
      ('profile_photo', 'Profile Photo URL', 'url', false, false, 17),
      ('user_id', 'User Name', 'text', false, false, 18),
      ('password', 'Password', 'password', false, false, 19),
      ('attachments_1', 'Attachment 1', 'file', false, true, 20),
      ('attachments_2', 'Attachment 2', 'file', false, false, 21),
      ('attachments_3', 'Attachment 3', 'file', false, false, 22),
      ('attachments_4', 'Attachment 4', 'file', false, false, 23),
      ('attachments_5', 'Attachment 5', 'file', false, false, 24),
      ('file_charge', 'File Charge', 'number', false, true, 25),
      ('income_slab', 'Income Slab', 'select', false, true, 26),
      ('comment_box', 'Comments', 'textarea', false, false, 27),
      ('customer_type', 'Customer Type', 'select', false, true, 28);
    `;
    await connection.execute(insertFieldsSQL);
    console.log('Default customer form fields inserted.');
  } catch (error) {
    console.error('Error creating customer form fields table:', error);
  } finally {
    await connection.end();
  }
}

createCustomerFormFieldsTable();
