import { pool, initDb } from '../db.js';

async function addItrIdToSubadminItr() {
    await initDb();
    try {
        // Check if column exists
        const [columns] = await pool.query('SHOW COLUMNS FROM subadmin_itr');
        const hasItrId = columns.some(c => c.Field === 'itr_id');

        if (!hasItrId) {
            await pool.query('ALTER TABLE subadmin_itr ADD COLUMN itr_id INT AFTER subadmin_id');
            await pool.query('ALTER TABLE subadmin_itr ADD CONSTRAINT fk_subadmin_itr_id FOREIGN KEY (itr_id) REFERENCES itr(id) ON DELETE CASCADE');
            console.log('itr_id column and foreign key added to subadmin_itr table');
        } else {
            console.log('itr_id column already exists in subadmin_itr table');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error altering subadmin_itr table:', error);
        process.exit(1);
    }
}

addItrIdToSubadminItr();
