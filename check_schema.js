import { pool, initDb } from './db.js';

async function checkSchema() {
    try {
        await initDb();
        const [rows] = await pool.query('SHOW CREATE TABLE ca_itr');
        console.log(rows[0]['Create Table']);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkSchema();
