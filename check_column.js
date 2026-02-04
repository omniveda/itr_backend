import { pool, initDb } from './db.js';

async function checkColumns() {
    await initDb();
    const [rows] = await pool.query("DESCRIBE customer");
    rows.forEach(r => {
        if (['last_ay_income', 'tds_amount', 'agent_id', 'user_id'].includes(r.Field)) {
            console.log(`${r.Field}: ${r.Type}`);
        }
    });
    process.exit(0);
}

checkColumns();
