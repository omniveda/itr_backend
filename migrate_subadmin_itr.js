import { pool, initDb } from './db.js';

async function migrate() {
    try {
        await initDb();

        // Check if status column exists in subadmin_itr
        const [rows] = await pool.query('DESCRIBE subadmin_itr');
        console.log('Rows from DESCRIBE:', rows);
        const subadminItrCols = rows;
        const hasStatus = subadminItrCols && subadminItrCols.some(c => c.Field === 'status');
        const hasItrId = subadminItrCols && subadminItrCols.some(c => c.Field === 'itr_id');

        if (!hasStatus) {
            console.log('Adding status column to subadmin_itr...');
            await pool.query('ALTER TABLE subadmin_itr ADD COLUMN status VARCHAR(50)');
        } else {
            console.log('Status column already exists in subadmin_itr.');
        }

        if (!hasItrId) {
            console.log('Adding itr_id column to subadmin_itr...');
            await pool.query('ALTER TABLE subadmin_itr ADD COLUMN itr_id INT');
            // Link it to itr table if possible
            try {
                await pool.query('ALTER TABLE subadmin_itr ADD CONSTRAINT fk_subadmin_itr_itr_id FOREIGN KEY (itr_id) REFERENCES itr(id) ON DELETE CASCADE');
            } catch (err) {
                console.warn('Could not add foreign key for itr_id:', err.message);
            }
        } else {
            console.log('itr_id column already exists in subadmin_itr.');
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
