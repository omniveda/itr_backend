import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'itr_system',
  port: 3306,
};

async function runMigration() {
  const connection = await mysql.createConnection(config);
  try {
    console.log('Starting migration: add agent_id to wallet_transactions');

    // 1. Add agent_id column (nullable for now so it won't break)
    await connection.execute(`ALTER TABLE wallet_transactions ADD COLUMN agent_id INT NULL`);
    console.log('Added column agent_id to wallet_transactions');

    // 2. Populate agent_id for existing records:
    // If wallet_id is present, try to map wallet_id -> agent_id via wallets table
    await connection.execute(`UPDATE wallet_transactions wt
      JOIN wallets w ON wt.wallet_id = w.id
      SET wt.agent_id = w.agent_id
      WHERE wt.agent_id IS NULL`);
    console.log('Populated agent_id from wallets where possible');

    // 3. For any remaining rows, set agent_id = performed_by (fallback)
    await connection.execute(`UPDATE wallet_transactions SET agent_id = performed_by WHERE agent_id IS NULL`);
    console.log('Set remaining agent_id from performed_by fallback');

    // 4. Add foreign key constraint to agent
    try {
      await connection.execute(`ALTER TABLE wallet_transactions ADD CONSTRAINT fk_wt_agent_id FOREIGN KEY (agent_id) REFERENCES agent(id)`);
      console.log('Added foreign key constraint fk_wt_agent_id');
    } catch (err) {
      console.warn('Could not add foreign key constraint (maybe it exists already) or insufficient privileges', err.message);
    }

    // 5. Make agent_id NOT NULL
    await connection.execute(`ALTER TABLE wallet_transactions MODIFY agent_id INT NOT NULL`);
    console.log('Made agent_id NOT NULL');

    // 6. Drop foreign key constraint if exists for wallet_id and drop wallet_id column
    try {
      // Try to find constraint name referencing wallets
      const [fks] = await connection.execute(`
        SELECT CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'wallet_transactions'
          AND REFERENCED_TABLE_NAME = 'wallets'
          AND REFERENCED_COLUMN_NAME = 'id'
      `);

      for (const fk of fks) {
        const fkName = fk.CONSTRAINT_NAME;
        await connection.execute(`ALTER TABLE wallet_transactions DROP FOREIGN KEY ${fkName}`);
        console.log(`Dropped foreign key ${fkName}`);
      }
    } catch (err) {
      console.warn('No FK to drop for wallet_id or error', err.message);
    }

    // Finally drop wallet_id column if exists
    try {
      await connection.execute(`ALTER TABLE wallet_transactions DROP COLUMN wallet_id`);
      console.log('Dropped wallet_id column');
    } catch (err) {
      console.warn('wallet_id column may not exist or could not be dropped', err.message);
    }

    console.log('Migration finished successfully');
  } catch (error) {
    console.error('Migration error:', error.message);
  } finally {
    await connection.end();
  }
}

runMigration();
