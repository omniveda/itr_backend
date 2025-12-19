import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
    host: 'localhost',
    user: 'root',
    password: '', // Please update with your password or use environment variables
    database: 'itr_system',
    port: 3306,
};

async function removeColumnsFromSubadminItr() {
    const connection = await mysql.createConnection(config);
    try {
        const alterTableSQL = `
      ALTER TABLE subadmin_itr
      DROP FOREIGN KEY subadmin_itr_ibfk_1,
      DROP COLUMN customer_id;
    `;
        await connection.execute(alterTableSQL);
        console.log('Columns removed from subadmin_itr table.');
    } catch (error) {
        console.error('Error removing columns from subadmin_itr table:', error);
    } finally {
        await connection.end();
    }
}

removeColumnsFromSubadminItr();
