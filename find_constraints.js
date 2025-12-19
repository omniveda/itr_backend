import { pool, initDb } from './db.js';

async function findConstraints() {
    try {
        await initDb();
        const [rows] = await pool.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_NAME = 'subadmin_itr'
      AND COLUMN_NAME = 'customer_id'
      AND TABLE_SCHEMA = DATABASE()
    `);
        console.log('Constraints for customer_id:', rows);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

findConstraints();
