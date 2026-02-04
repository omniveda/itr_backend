import fs from 'fs';
import csv from 'csv-parser';

const CSV_FILE_PATH = 'F:/Project/Incometaxreturn/Data/real_data/customer.csv';

let invalidCount = 0;
fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv({
        quote: '\0',
        mapHeaders: ({ header }) => header.trim().toLowerCase(),
        strict: false
    }))
    .on('data', (row) => {
        const values = Object.values(row).map(v => v ? v.toString().trim() : '');
        const valCleanJoin = values.join('|').replace(/\s/g, '');

        const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]{1}/i;
        const mobileRegex = /[6-9]\d{9}/;

        const hasPan = panRegex.test(valCleanJoin);
        const hasMobile = mobileRegex.test(valCleanJoin);

        if (!hasPan && !hasMobile) {
            invalidCount++;
            if (invalidCount <= 10) {
                console.log(`Invalid Row ${invalidCount}:`, JSON.stringify(row));
                console.log(`Values:`, values.filter(v => v !== ''));
            }
        }
    })
    .on('end', () => {
        console.log(`Total Invalid rows: ${invalidCount}`);
        process.exit(0);
    });
