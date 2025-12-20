import { pool, initDb } from './db.js';

async function migrate() {
    try {
        await initDb();
        console.log('Starting migration for ca_itr table...');

        const [cols] = await pool.query('DESCRIBE ca_itr');
        const colNames = cols.map(c => c.Field);

        if (!colNames.includes('itr_id')) {
            console.log('Adding itr_id column to ca_itr...');
            await pool.query('ALTER TABLE ca_itr ADD COLUMN itr_id INT');
            // Try to populate itr_id from customer_id if it exists
            if (colNames.includes('customer_id')) {
                console.log('Populating itr_id from customer_id...');
                await pool.query(`
                    UPDATE ca_itr ci
                    JOIN itr i ON ci.customer_id = i.customer_id
                    SET ci.itr_id = i.id
                    WHERE ci.itr_id IS NULL
                `);
            }
        }

        if (!colNames.includes('status')) {
            console.log('Adding status column to ca_itr...');
            await pool.query("ALTER TABLE ca_itr ADD COLUMN status VARCHAR(50) DEFAULT 'Filled'");
        }

        console.log('Migration for ca_itr completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
