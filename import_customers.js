import fs from 'fs';
import csv from 'csv-parser';
import bcrypt from 'bcrypt';
import { pool, initDb } from './db.js';

const CSV_FILE_PATH = 'F:/Project/Incometaxreturn/Data/real_data/customer.csv';
const SALT_ROUNDS = 10;

function formatDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;
    const parts = dateStr.trim().split('/');
    if (parts.length === 3) {
        // Assume DD/MM/YYYY
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2];
        return `${y}-${m}-${d}`;
    }
    return dateStr.trim(); // Return as is if already YYYY-MM-DD or other format
}

async function importCustomers() {
    try {
        await initDb();
        console.log('Database initialized');

        const customers = [];

        // Check if file exists
        if (!fs.existsSync(CSV_FILE_PATH)) {
            console.error(`CSV file not found at: ${CSV_FILE_PATH}`);
            process.exit(1);
        }

        console.log(`Reading CSV from: ${CSV_FILE_PATH}`);

        fs.createReadStream(CSV_FILE_PATH)
            .pipe(csv({
                quote: '\b', // Disable quote handling to avoid swallowing lines
                mapHeaders: ({ header }) => header.trim().toLowerCase(),
                strict: false
            }))
            .on('data', (row) => {
                // Trim all values and clean identifiers
                const cleanRow = {};
                Object.keys(row).forEach(key => {
                    const trimmedKey = key.trim().toLowerCase();
                    let val = row[key];
                    if (val) {
                        val = val.toString().trim();
                        // Clean identifiers: remove spaces and truncate to DB limits
                        if (['pan_number', 'adhar_number', 'mobile_no'].includes(trimmedKey)) {
                            val = val.replace(/\s/g, '');
                            if (trimmedKey === 'pan_number') val = val.substring(0, 10).toUpperCase();
                            if (trimmedKey === 'adhar_number') val = val.substring(0, 12);
                            if (trimmedKey === 'mobile_no') val = val.substring(0, 20);
                        }
                    }
                    cleanRow[trimmedKey] = val || null;
                });

                // Simple validation: check if pan_number or mobile_no exists
                if (cleanRow.pan_number || cleanRow.mobile_no) {
                    customers.push(cleanRow);
                }
            })
            .on('end', async () => {
                console.log(`Parsed ${customers.length} customers from CSV.`);

                if (customers.length === 0) {
                    console.log('No valid customers found in CSV.');
                    process.exit(0);
                }

                let successCount = 0;
                let errorCount = 0;

                for (const customer of customers) {
                    try {
                        const plainPassword = customer.password || '123456';
                        const hashedPassword = await bcrypt.hash(plainPassword.toString(), SALT_ROUNDS);

                        // Use pan_number as primary matching key, fallback to mobile_no
                        let existing = [];
                        if (customer.pan_number) {
                            [existing] = await pool.query('SELECT id FROM customer WHERE pan_number = ?', [customer.pan_number]);
                        } else if (customer.mobile_no) {
                            [existing] = await pool.query('SELECT id FROM customer WHERE mobile_no = ?', [customer.mobile_no]);
                        }

                        const customerData = {
                            name: customer.name,
                            father_name: customer.father_name,
                            dob: formatDate(customer.dob),
                            pan_number: customer.pan_number,
                            adhar_number: customer.adhar_number,
                            account_number: customer.account_number,
                            bank_name: customer.bank_name,
                            ifsc_code: customer.ifsc_code,
                            tds_amount: customer.tds_amount,
                            itr_password: customer.itr_password,
                            income_type: customer.income_type,
                            mobile_no: customer.mobile_no,
                            mail_id: customer.mail_id,
                            filling_type: customer.filling_type,
                            last_ay_income: customer.last_ay_income,
                            profile_photo: customer.profile_photo,
                            user_id: customer.user_id,
                            password: hashedPassword,
                            attachments_1: customer.attachments_1,
                            attachments_2: customer.attachments_2,
                            attachments_3: customer.attachments_3,
                            attachments_4: customer.attachments_4,
                            attachments_5: customer.attachments_5,
                            apply_date: formatDate(customer.apply_date),
                            updated_date: formatDate(customer.updated_date),
                            income_slab: customer.income_slab,
                            comment_box: customer.comment_box,
                            customer_type: customer.customer_type,
                            agent_id: customer.agent_id && !isNaN(customer.agent_id) ? parseInt(customer.agent_id) : null,
                            attachments_6: customer.attachments_6
                        };

                        if (existing.length > 0) {
                            const updateSQL = `
                                UPDATE customer SET 
                                    name = ?, father_name = ?, dob = ?, adhar_number = ?, 
                                    account_number = ?, bank_name = ?, ifsc_code = ?, tds_amount = ?, 
                                    itr_password = ?, income_type = ?, mobile_no = ?, mail_id = ?, 
                                    filling_type = ?, last_ay_income = ?, profile_photo = ?, user_id = ?, 
                                    password = ?, attachments_1 = ?, attachments_2 = ?, attachments_3 = ?, 
                                    attachments_4 = ?, attachments_5 = ?, apply_date = ?, updated_date = ?, 
                                    income_slab = ?, comment_box = ?, customer_type = ?, agent_id = ?, 
                                    attachments_6 = ?
                                WHERE id = ?
                            `;
                            await pool.query(updateSQL, [
                                customerData.name, customerData.father_name, customerData.dob, customerData.adhar_number,
                                customerData.account_number, customerData.bank_name, customerData.ifsc_code, customerData.tds_amount,
                                customerData.itr_password, customerData.income_type, customerData.mobile_no, customerData.mail_id,
                                customerData.filling_type, customerData.last_ay_income, customerData.profile_photo, customerData.user_id,
                                customerData.password, customerData.attachments_1, customerData.attachments_2, customerData.attachments_3,
                                customerData.attachments_4, customerData.attachments_5, customerData.apply_date, customerData.updated_date,
                                customerData.income_slab, customerData.comment_box, customerData.customer_type, customerData.agent_id,
                                customerData.attachments_6,
                                existing[0].id
                            ]);
                        } else {
                            const insertSQL = `
                                INSERT INTO customer (
                                    name, father_name, dob, pan_number, adhar_number, 
                                    account_number, bank_name, ifsc_code, tds_amount, 
                                    itr_password, income_type, mobile_no, mail_id, 
                                    filling_type, last_ay_income, profile_photo, user_id, 
                                    password, attachments_1, attachments_2, attachments_3, 
                                    attachments_4, attachments_5, apply_date, updated_date, 
                                    income_slab, comment_box, customer_type, agent_id, 
                                    attachments_6
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `;
                            await pool.query(insertSQL, [
                                customerData.name, customerData.father_name, customerData.dob, customerData.pan_number, customerData.adhar_number,
                                customerData.account_number, customerData.bank_name, customerData.ifsc_code, customerData.tds_amount,
                                customerData.itr_password, customerData.income_type, customerData.mobile_no, customerData.mail_id,
                                customerData.filling_type, customerData.last_ay_income, customerData.profile_photo, customerData.user_id,
                                customerData.password, customerData.attachments_1, customerData.attachments_2, customerData.attachments_3,
                                customerData.attachments_4, customerData.attachments_5, customerData.apply_date, customerData.updated_date,
                                customerData.income_slab, customerData.comment_box, customerData.customer_type, customerData.agent_id,
                                customerData.attachments_6
                            ]);
                        }
                        successCount++;
                        if (successCount % 100 === 0) console.log(`Imported ${successCount} customers...`);
                    } catch (err) {
                        console.error(`Error processing customer ${customer.pan_number || customer.mobile_no}:`, err.message);
                        errorCount++;
                    }
                }

                console.log('--- Import Summary ---');
                console.log(`Total processed: ${customers.length}`);
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

importCustomers();
