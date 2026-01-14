import { pool, initDb } from './db.js';

async function migrate() {
    try {
        await initDb();
        console.log('Adding extra_charge column to itr table...');
        await pool.query('ALTER TABLE itr ADD COLUMN extra_charge DECIMAL(10, 2) DEFAULT NULL AFTER Comment');
        console.log('Column added successfully.');
        process.exit(0);
    } catch (error) {
        if (error.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Column extra_charge already exists.');
            process.exit(0);
        } else {
            console.error('Error adding column:', error);
            process.exit(1);
        }
    }
}

migrate();
