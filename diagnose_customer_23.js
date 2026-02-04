import fs from 'fs';
import csv from 'csv-parser';

const CSV_FILE_PATH = 'F:/Project/Incometaxreturn/Data/real_data/customer-23-real-data.csv';

async function diagnose() {
    let count = 0;
    let validCount = 0;
    let headers = [];

    const stream = fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv({
            quote: '\0',
            mapHeaders: ({ header }) => header.trim().toLowerCase(),
            strict: false
        }));

    stream.on('headers', (h) => {
        headers = h;
        console.log('Detected Headers:', headers);
        console.log('Header Count:', headers.length);
    });

    stream.on('data', (row) => {
        count++;
        const values = Object.values(row).map(v => v ? v.toString().trim() : '');
        const valuesNoSpace = values.map(v => v.replace(/\s/g, ''));

        const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]{1}/i;
        const adharRegex = /^[0-9]{12}$/;
        const mobileRegex = /^[6-9]\d{9}$/;

        let hasPan = false;
        let hasAdhar = false;
        let hasMobile = false;

        for (let i = 0; i < valuesNoSpace.length; i++) {
            const v = valuesNoSpace[i];
            if (panRegex.test(v)) hasPan = true;
            if (adharRegex.test(v)) hasAdhar = true;
            if (mobileRegex.test(v)) hasMobile = true;
        }

        if (hasPan || hasMobile) {
            validCount++;
            if (validCount <= 5) {
                console.log(`Sample valid row ${validCount}:`, JSON.stringify(row).substring(0, 200) + '...');
            }
        }

        if (count % 500 === 0) console.log(`Processed ${count} rows...`);
    });

    stream.on('end', () => {
        console.log('--- Diagnosis Result ---');
        console.log(`Total Rows: ${count}`);
        console.log(`Valid (PAN or Mobile found): ${validCount}`);
        console.log('------------------------');
        process.exit(0);
    });
}

diagnose();
