import { pool, initDb } from './db.js';

async function checkSchema() {
    try {
        await initDb();
        console.log('Database initialized');

        const [rows] = await pool.query('DESCRIBE agent');
        console.log('Agent table schema:');
        console.table(rows);

        process.exit(0);
    } catch (error) {
        console.error('Error checking schema:', error);
        process.exit(1);
    }
}

checkSchema();
