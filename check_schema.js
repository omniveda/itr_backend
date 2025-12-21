import { pool, initDb } from './db.js';

async function checkSchema() {
    try {
        await initDb();
        const [itr] = await pool.query('DESCRIBE itr');
        const [customer] = await pool.query('DESCRIBE customer');
        console.log('ITR Schema:', itr);
        console.log('Customer Schema:', customer);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkSchema();
