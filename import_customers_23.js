import fs from 'fs';
import csv from 'csv-parser';
import bcrypt from 'bcrypt';
import { pool, initDb } from './db.js';

const CSV_FILE_PATH = 'F:/Project/Incometaxreturn/Data/real_data/customer-23-real-data.csv';
const SALT_ROUNDS = 10;

function formatDateHeuristic(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    let s = dateStr.trim();
    if (s === '') return null;

    // Handle DD-MMM-YY (e.g., 1-Jul-81)
    const months = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };
    const mmmRegex = /^(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2,4})$/i;
    const matchMMM = s.match(mmmRegex);
    if (matchMMM) {
        const d = matchMMM[1].padStart(2, '0');
        const m = months[matchMMM[2].toLowerCase()];
        let y = matchMMM[3];
        if (y.length === 2) {
            y = parseInt(y) > 30 ? '19' + y : '20' + y;
        }
        return `${y}-${m}-${d}`;
    }

    // Handle DD/MM/YYYY
    const parts = s.split('/');
    if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2];
        if (d > 0 && d <= 31 && m > 0 && m <= 12 && y.length === 4) {
            return `${y}-${m}-${d}`;
        }
    }

    // Handle YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return s;
    }

    return null;
}

function fixSciNotation(val) {
    if (!val) return null;
    const s = val.toString().trim();
    if (s.includes('E+') || s.includes('e+')) {
        return Number(s).toLocaleString('fullwide', { useGrouping: false });
    }
    return s;
}

async function importCustomers23() {
    try {
        await initDb();
        console.log('Database initialized');

        const customers = [];

        fs.createReadStream(CSV_FILE_PATH)
            .pipe(csv({
                quote: '\0',
                mapHeaders: ({ header }) => header.trim().toLowerCase(),
                strict: false
            }))
            .on('data', (row) => {
                const values = Object.values(row).map(v => v ? v.toString().trim() : '');
                const valuesNoSpace = values.map(v => v.replace(/\s/g, ''));

                const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]{1}/i;
                const adharRegex = /^[0-9]{12}$/;
                const mobileRegex = /^[6-9]\d{9}$/;
                const dateRegex = /(\d{1,2}\/\d{2}\/\d{4})|(\d{1,2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2,4})/i;

                let pan = null;
                let adhar = null;
                let mobile = null;
                let foundDates = [];

                for (let i = 0; i < values.length; i++) {
                    const v = values[i];
                    const vClean = valuesNoSpace[i];

                    if (!pan && panRegex.test(vClean)) {
                        pan = vClean.match(panRegex)[0].toUpperCase();
                    } else if (!adhar && adharRegex.test(vClean)) {
                        adhar = vClean;
                    } else if (!mobile && mobileRegex.test(vClean)) {
                        mobile = vClean;
                    }

                    const m = v.match(dateRegex);
                    if (m) {
                        if (!foundDates.includes(m[0])) foundDates.push(m[0]);
                    }
                }

                // If heuristic identity found, keep the row
                if (pan || mobile) {
                    let dob = null;
                    let applyDate = null;
                    let updatedDate = null;

                    foundDates.forEach(d => {
                        const formatted = formatDateHeuristic(d);
                        if (!formatted) return;
                        const year = parseInt(formatted.split('-')[0]);
                        if (year < 2005) {
                            if (!dob) dob = d;
                        } else {
                            if (!applyDate) applyDate = d;
                            else updatedDate = d;
                        }
                    });

                    customers.push({
                        ...row,
                        pan_number_h: pan,
                        adhar_number_h: adhar,
                        mobile_no_h: mobile,
                        dob_h: dob,
                        apply_date_h: applyDate,
                        updated_date_h: updatedDate
                    });
                }
            })
            .on('end', async () => {
                console.log(`Parsed ${customers.length} customers with identifier. Starting import...`);

                let successCount = 0;
                let errorCount = 0;

                const cleanNum = (val) => {
                    const s = fixSciNotation(val);
                    if (!s || isNaN(s)) return null;
                    return s;
                };

                for (const customer of customers) {
                    try {
                        const plainPassword = customer.password || '123456';
                        const hashedPassword = await bcrypt.hash(plainPassword.toString(), SALT_ROUNDS);

                        let pan = customer.pan_number_h || (customer.pan_number ? customer.pan_number.toString().replace(/\s/g, '').toUpperCase() : null);
                        let mobile = customer.mobile_no_h || (customer.mobile_no ? customer.mobile_no.toString().replace(/\s/g, '') : null);
                        let adhar = fixSciNotation(customer.adhar_number_h) || fixSciNotation(customer.adhar_number);

                        if (!pan && !mobile) continue;

                        let existing = [];
                        if (pan) {
                            [existing] = await pool.query('SELECT id FROM customer WHERE pan_number = ?', [pan]);
                        } else {
                            [existing] = await pool.query('SELECT id FROM customer WHERE mobile_no = ?', [mobile]);
                        }

                        const customerData = {
                            name: (customer.name || '').substring(0, 255),
                            father_name: (customer.father_name || '').substring(0, 255),
                            dob: formatDateHeuristic(customer.dob_h || customer.dob),
                            pan_number: pan ? pan.substring(0, 10) : null,
                            adhar_number: adhar ? adhar.substring(0, 12) : null,
                            account_number: fixSciNotation(customer.account_number) ? fixSciNotation(customer.account_number).substring(0, 50) : null,
                            bank_name: (customer.bank_name || '').substring(0, 255),
                            ifsc_code: (customer.ifsc_code || customer['ifsc_code '] || '').trim().substring(0, 20),
                            tds_amount: cleanNum(customer.tds_amount),
                            itr_password: (customer.itr_password || '').substring(0, 255),
                            income_type: (customer.income_type || '').substring(0, 255),
                            mobile_no: mobile ? mobile.substring(0, 20) : null,
                            mail_id: (customer.mail_id || '').substring(0, 255),
                            filling_type: (customer.filling_type || '').substring(0, 255),
                            last_ay_income: cleanNum(customer.last_ay_income),
                            profile_photo: (customer.profile_photo || '').substring(0, 255),
                            user_id: customer.user_id ? customer.user_id.toString().substring(0, 255) : null,
                            password: hashedPassword,
                            attachments_1: (customer.attachments_1 || '').substring(0, 255),
                            attachments_2: (customer.attachments_2 || '').substring(0, 255),
                            attachments_3: (customer.attachments_3 || '').substring(0, 255),
                            attachments_4: (customer.attachments_4 || '').substring(0, 255),
                            attachments_5: (customer.attachments_5 || '').substring(0, 255),
                            apply_date: formatDateHeuristic(customer.apply_date_h || customer.apply_date),
                            updated_date: formatDateHeuristic(customer.updated_date_h || customer.updated_date),
                            income_slab: (customer.income_slab || '').substring(0, 255),
                            comment_box: customer.comment_box,
                            customer_type: (customer.customer_type || '').substring(0, 255),
                            agent_id: cleanNum(customer.agent_id),
                            attachments_6: (customer.attachments_6 || '').substring(0, 255)
                        };

                        if (existing.length > 0) {
                            const updateSQL = `UPDATE customer SET name=?, father_name=?, dob=?, adhar_number=?, account_number=?, bank_name=?, ifsc_code=?, tds_amount=?, itr_password=?, income_type=?, mobile_no=?, mail_id=?, filling_type=?, last_ay_income=?, profile_photo=?, user_id=?, password=?, attachments_1=?, attachments_2=?, attachments_3=?, attachments_4=?, attachments_5=?, apply_date=?, updated_date=?, income_slab=?, comment_box=?, customer_type=?, agent_id=?, attachments_6=? WHERE id=?`;
                            await pool.query(updateSQL, [customerData.name, customerData.father_name, customerData.dob, customerData.adhar_number, customerData.account_number, customerData.bank_name, customerData.ifsc_code, customerData.tds_amount, customerData.itr_password, customerData.income_type, customerData.mobile_no, customerData.mail_id, customerData.filling_type, customerData.last_ay_income, customerData.profile_photo, customerData.user_id, customerData.password, customerData.attachments_1, customerData.attachments_2, customerData.attachments_3, customerData.attachments_4, customerData.attachments_5, customerData.apply_date, customerData.updated_date, customerData.income_slab, customerData.comment_box, customerData.customer_type, customerData.agent_id, customerData.attachments_6, existing[0].id]);
                        } else {
                            const insertSQL = `INSERT INTO customer (name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code, tds_amount, itr_password, income_type, mobile_no, mail_id, filling_type, last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3, attachments_4, attachments_5, apply_date, updated_date, income_slab, comment_box, customer_type, agent_id, attachments_6) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                            await pool.query(insertSQL, [customerData.name, customerData.father_name, customerData.dob, customerData.pan_number, customerData.adhar_number, customerData.account_number, customerData.bank_name, customerData.ifsc_code, customerData.tds_amount, customerData.itr_password, customerData.income_type, customerData.mobile_no, customerData.mail_id, customerData.filling_type, customerData.last_ay_income, customerData.profile_photo, customerData.user_id, customerData.password, customerData.attachments_1, customerData.attachments_2, customerData.attachments_3, customerData.attachments_4, customerData.attachments_5, customerData.apply_date, customerData.updated_date, customerData.income_slab, customerData.comment_box, customerData.customer_type, customerData.agent_id, customerData.attachments_6]);
                        }
                        successCount++;
                        if (successCount % 100 === 0) console.log(`Processed ${successCount} customers...`);
                    } catch (err) {
                        console.error(`Error with customer ${customer.pan_number_h || customer.mobile_no_h || 'unknown'}:`, err.message);
                        errorCount++;
                    }
                }

                console.log('--- Final Import Summary ---');
                console.log(`Success: ${successCount}, Errors: ${errorCount}`);
                process.exit(0);
            });
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

importCustomers23();
