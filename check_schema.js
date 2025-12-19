import { pool, initDb } from './db.js';

async function checkSchema() {
    try {
        await initDb();
        const [cols] = await pool.query('DESCRIBE ca_itr');
        console.log('--- ca_itr ---');
        cols.forEach(f => console.log(`${f.Field}: ${f.Type}`));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkSchema();
