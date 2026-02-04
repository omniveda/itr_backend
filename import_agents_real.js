import fs from 'fs';
import csv from 'csv-parser';
import bcrypt from 'bcrypt';
import { pool, initDb } from './db.js';

const CSV_FILE_PATH = 'F:/Project/Incometaxreturn/Data/real_data/agent-real-data.csv';
const SALT_ROUNDS = 10;

async function importAgentsReal() {
    try {
        await initDb();
        console.log('Database initialized');

        const agents = [];

        console.log(`Reading CSV from: ${CSV_FILE_PATH}`);

        fs.createReadStream(CSV_FILE_PATH)
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim().toLowerCase()
            }))
            .on('data', (row) => {
                // Trim all values in the row
                Object.keys(row).forEach(key => {
                    if (row[key]) row[key] = row[key].trim();
                });

                // Validation: mobile_no is required
                if (row.mobile_no && row.mobile_no !== '') {
                    agents.push(row);
                }
            })
            .on('end', async () => {
                console.log(`Parsed ${agents.length} agents from CSV.`);

                if (agents.length === 0) {
                    console.log('No agents found in CSV.');
                    process.exit(0);
                }

                let successCount = 0;
                let errorCount = 0;

                for (const agent of agents) {
                    try {
                        const plainPassword = agent.password || '123456';
                        const hashedPassword = await bcrypt.hash(plainPassword.toString(), SALT_ROUNDS);

                        // Check if agent already exists by mobile_no
                        const [existing] = await pool.query('SELECT id FROM agent WHERE mobile_no = ?', [agent.mobile_no]);

                        const agentData = {
                            name: agent.name || null,
                            father_name: agent.father_name || null,
                            mobile_no: agent.mobile_no || null,
                            mail_id: agent.mail_id || null,
                            address: agent.address || null,
                            profile_photo: agent.profile_photo || null,
                            alternate_mobile_no: agent.alternate_mobile_no || null,
                            isagent: agent.isagent || 'verified',
                            password: hashedPassword,
                            wbalance: agent.wbalance && !isNaN(agent.wbalance) ? parseInt(agent.wbalance) : 0,
                            file_charge: agent.file_charge && !isNaN(agent.file_charge) ? parseInt(agent.file_charge) : 0,
                            isdownload: agent.isdownload || 'unverified'
                        };

                        if (existing.length > 0) {
                            // Update existing agent
                            const updateSQL = `
                                UPDATE agent SET 
                                    name = ?, father_name = ?, mail_id = ?, address = ?, 
                                    profile_photo = ?, alternate_mobile_no = ?, isagent = ?, 
                                    password = ?, wbalance = ?, file_charge = ?, isdownload = ?
                                WHERE id = ?
                            `;
                            await pool.query(updateSQL, [
                                agentData.name, agentData.father_name, agentData.mail_id, agentData.address,
                                agentData.profile_photo, agentData.alternate_mobile_no, agentData.isagent,
                                agentData.password, agentData.wbalance, agentData.file_charge, agentData.isdownload,
                                existing[0].id
                            ]);
                        } else {
                            // Insert new agent
                            const insertSQL = `
                                INSERT INTO agent (
                                    name, father_name, mobile_no, mail_id, address, 
                                    profile_photo, alternate_mobile_no, isagent, 
                                    password, wbalance, file_charge, isdownload
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `;
                            await pool.query(insertSQL, [
                                agentData.name, agentData.father_name, agentData.mobile_no, agentData.mail_id, agentData.address,
                                agentData.profile_photo, agentData.alternate_mobile_no, agentData.isagent,
                                agentData.password, agentData.wbalance, agentData.file_charge, agentData.isdownload
                            ]);
                        }
                        successCount++;
                    } catch (err) {
                        console.error(`Error processing agent ${agent.mobile_no}:`, err.message);
                        errorCount++;
                    }
                }

                console.log('--- Import Summary ---');
                console.log(`Total processed: ${agents.length}`);
                console.log(`Success (Insert/Update): ${successCount}`);
                console.log(`Errors: ${errorCount}`);
                console.log('-----------------------');
                process.exit(0);
            });

    } catch (error) {
        console.error('Fatal error initializing database:', error);
        process.exit(1);
    }
}

importAgentsReal();
