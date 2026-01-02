import { pool, initDb } from './db.js';

async function checkFields() {
    await initDb();
    try {
        const [rows] = await pool.query('SELECT field_name FROM customer_form_fields');
        console.log('FIELD_NAMES_START');
        console.log(rows.map(r => r.field_name).join(', '));
        console.log('FIELD_NAMES_END');
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkFields();
