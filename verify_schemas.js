import { pool, initDb } from './db.js';

async function verify() {
    await initDb();
    try {
        const [itr_customer_cols] = await pool.query('SHOW COLUMNS FROM itr_customer');
        console.log('itr_customer columns:', itr_customer_cols.map(c => c.Field));

        const [subadmin_itr_cols] = await pool.query('SHOW COLUMNS FROM subadmin_itr');
        console.log('subadmin_itr columns:', subadmin_itr_cols.map(c => c.Field));

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

verify();
