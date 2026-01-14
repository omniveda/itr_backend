import { pool, initDb } from '../db.js';

async function addIsEnabledToRatecard() {
    await initDb();
    const query = `
    ALTER TABLE ratecard
    ADD COLUMN is_enabled BOOLEAN NOT NULL DEFAULT TRUE;
  `;

    try {
        await pool.query(query);
        console.log('Added is_enabled column to ratecard table successfully');
        process.exit(0);
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('Column is_enabled already exists');
            process.exit(0);
        }
        console.error('Error adding is_enabled column to ratecard table:', error);
        process.exit(1);
    }
}

addIsEnabledToRatecard();
