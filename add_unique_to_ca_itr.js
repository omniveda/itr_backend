import { pool, initDb } from './db.js';

async function addUniqueConstraint() {
    try {
        await initDb();
        console.log('Starting migration to add UNIQUE constraint to ca_itr(itr_id)...');

        // Check if constraint already exists
        const [constraints] = await pool.query(`
            SELECT CONSTRAINT_NAME 
            FROM information_schema.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = 'itr_system' 
            AND TABLE_NAME = 'ca_itr' 
            AND CONSTRAINT_TYPE = 'UNIQUE'
            AND CONSTRAINT_NAME = 'unique_itr_id'
        `);

        if (constraints.length > 0) {
            console.log('UNIQUE constraint "unique_itr_id" already exists.');
        } else {
            await pool.query('ALTER TABLE ca_itr ADD CONSTRAINT unique_itr_id UNIQUE (itr_id)');
            console.log('Added UNIQUE constraint "unique_itr_id" to ca_itr(itr_id)');
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

addUniqueConstraint();
