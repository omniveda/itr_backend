
import { pool, initDb } from './db.js';

async function migrate() {
    try {
        await initDb();
        console.log('Database initialized');

        const tables = [
            `CREATE TABLE IF NOT EXISTS itr_flow (
                id INT AUTO_INCREMENT PRIMARY KEY,
                itr_id INT NOT NULL,
                customer_id INT NOT NULL,
                itr_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                subadmin_id INT NULL,
                subadmin_take_date DATETIME NULL,
                ca_id INT NULL,
                ca_assign_date DATETIME NULL,
                ca_filled_date DATETIME NULL,
                everification_date DATETIME NULL,
                completed_date DATETIME NULL,
                FOREIGN KEY (itr_id) REFERENCES itr(id) ON DELETE CASCADE,
                FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS itr_rejection_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                itr_id INT NOT NULL,
                rejected_by_type ENUM('subadmin', 'ca', 'superadmin') NOT NULL,
                rejected_by_id INT NOT NULL,
                reason TEXT NOT NULL,
                extra_charge DECIMAL(10,2) DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (itr_id) REFERENCES itr(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS subadmin_itr_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                subadmin_id INT NOT NULL,
                subadmin_name VARCHAR(255) NOT NULL,
                pending TINYINT(1) DEFAULT 1,
                in_progress TINYINT(1) DEFAULT 1,
                e_verification TINYINT(1) DEFAULT 1,
                completed TINYINT(1) DEFAULT 1,
                rejected TINYINT(1) DEFAULT 1,
                flow TINYINT(1) DEFAULT 1,
                ca_change TINYINT(1) DEFAULT 1,
                recharge_not TINYINT(1) DEFAULT 1,
                itr_history TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (subadmin_id) REFERENCES subadmin(id) ON DELETE CASCADE,
                UNIQUE KEY (subadmin_id)
            )`
        ];

        for (const sql of tables) {
            await pool.query(sql);
            console.log('Table created or already exists');
        }

        // Seed existing ITRs into itr_flow if they don't exist
        console.log('Seeding existing ITRs into itr_flow...');
        await pool.query(`
            INSERT INTO itr_flow (itr_id, customer_id, itr_date)
            SELECT id, customer_id, created_at FROM itr
            WHERE id NOT IN (SELECT itr_id FROM itr_flow)
        `);
        console.log('Existing ITRs seeded');

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
