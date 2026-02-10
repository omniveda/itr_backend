import mysql from 'mysql2/promise';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load .env from backend directory
const backendEnvPath = path.join(process.cwd(), 'backend', '.env');
if (fs.existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath });
} else {
    dotenv.config();
}

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
};

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Database connected');

        // Check if column exists
        const [columns] = await connection.query('DESCRIBE agent');
        const columnExists = columns.some(col => col.Field === 'register_date');

        if (!columnExists) {
            console.log('Adding register_date column...');
            await connection.query('ALTER TABLE agent ADD COLUMN register_date DATE');
            console.log('Column added successfully');

            console.log('Backfilling register_date for existing agents...');
            const today = new Date().toISOString().split('T')[0];
            await connection.query('UPDATE agent SET register_date = ? WHERE register_date IS NULL', [today]);
            console.log('Backfill completed');
        } else {
            console.log('register_date column already exists');
        }

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
