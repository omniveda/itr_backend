import { pool, initDb } from './db.js';

async function fixFk() {
    try {
        await initDb();
        console.log('Starting migration to fix ca_itr foreign keys...');

        // 1. Drop the incorrect foreign key
        try {
            await pool.query('ALTER TABLE ca_itr DROP FOREIGN KEY ca_itr_ibfk_1');
            console.log('Dropped incorrect foreign key ca_itr_ibfk_1');
        } catch (e) {
            console.log('Foreign key ca_itr_ibfk_1 not found or already dropped.');
        }

        // 2. Add the correct foreign key for itr_id
        await pool.query('ALTER TABLE ca_itr ADD CONSTRAINT fk_ca_itr_itr FOREIGN KEY (itr_id) REFERENCES itr(id)');
        console.log('Added correct foreign key fk_ca_itr_itr (itr_id -> itr.id)');

        // 3. Optional: Remove customer_id since we use itr_id now
        try {
            await pool.query('ALTER TABLE ca_itr DROP COLUMN customer_id');
            console.log('Removed redundant customer_id column from ca_itr');
        } catch (e) {
            console.log('customer_id column not found or already removed.');
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

fixFk();
