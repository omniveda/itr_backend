import fs from 'fs';
import csv from 'csv-parser';
import bcrypt from 'bcrypt';
import { pool, initDb } from './db.js';

const CSV_FILE_PATH = 'F:/Project/Incometaxreturn/Data/real_data/agent.csv';
const SALT_ROUNDS = 10;

async function importAgents() {
    try {
        await initDb();
        console.log('Database initialized');

        const agents = [];

        // Check if file exists
        if (!fs.existsSync(CSV_FILE_PATH)) {
            console.error(`CSV file not found at: ${CSV_FILE_PATH}`);
            process.exit(1);
        }

        console.log(`Reading CSV from: ${CSV_FILE_PATH}`);

        fs.createReadStream(CSV_FILE_PATH)
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim()
            }))
            .on('data', (row) => {
                // Simple validation: check if mobile_no exists and is not empty
                if (row.mobile_no && row.mobile_no.trim() !== '') {
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

                        // Check if agent already exists (by mobile_no)
                        const [existing] = await pool.query('SELECT id FROM agent WHERE mobile_no = ?', [agent.mobile_no]);

                        const agentData = {
                            name: agent.name || null,
                            father_name: agent.father_name || null,
                            mobile_no: agent.mobile_no,
                            mail_id: agent.mail_id || null,
                            address: agent.address || null,
                            profile_photo: agent.profile_photo || null,
                            alternate_mobile_no: agent.alternate_mobile_no || null,
                            isagent: agent.isagent || 'verified',
                            password: hashedPassword,
                            wbalance: agent.wbalance || 0,
                            file_charge: agent.file_charge || 300,
                            isdownload: agent.isdownload || 'unverified'
                        };

                        if (existing.length > 0) {
                            // Update existing agent
                            const updateSQL = `
                UPDATE agent SET 
                  name = ?, father_name = ?, mail_id = ?, address = ?, 
                  profile_photo = ?, alternate_mobile_no = ?, isagent = ?, 
                  password = ?, wbalance = ?, file_charge = ?, isdownload = ?
                WHERE mobile_no = ?
              `;
                            await pool.query(updateSQL, [
                                agentData.name, agentData.father_name, agentData.mail_id, agentData.address,
                                agentData.profile_photo, agentData.alternate_mobile_no, agentData.isagent,
                                agentData.password, agentData.wbalance, agentData.file_charge, agentData.isdownload,
                                agentData.mobile_no
                            ]);
                            successCount++;
                        } else {
                            // Insert new agent
                            const insertSQL = `
                INSERT INTO agent (
                  name, father_name, mobile_no, mail_id, address, 
                  profile_photo, alternate_mobile_no, isagent, password, 
                  wbalance, file_charge, isdownload
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;
                            await pool.query(insertSQL, [
                                agentData.name, agentData.father_name, agentData.mobile_no, agentData.mail_id, agentData.address,
                                agentData.profile_photo, agentData.alternate_mobile_no, agentData.isagent, agentData.password,
                                agentData.wbalance, agentData.file_charge, agentData.isdownload
                            ]);
                            successCount++;
                        }
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
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

importAgents();
