import { pool, initDb } from '../db.js';

async function createRatecardTable() {
  await initDb();
  const query = `
    CREATE TABLE IF NOT EXISTS ratecard (
      id INT AUTO_INCREMENT PRIMARY KEY,
      income_slab VARCHAR(255) NOT NULL,
      assessment_year VARCHAR(50) NOT NULL,
      calendar_from DATE NOT NULL,
      calendar_to DATE NOT NULL,
      penalty_amount DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  try {
    await pool.query(query);
    console.log('Ratecard table created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating ratecard table:', error);
    process.exit(1);
  }
}

createRatecardTable();
