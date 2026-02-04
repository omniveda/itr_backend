import fs from 'fs';
import csv from 'csv-parser';

const CSV_FILE_PATH = 'F:/Project/Incometaxreturn/Data/real_data/customer.csv';

let count = 0;
fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv({
        quote: '\b', // Effectively disable quote handling using backspace char
        mapHeaders: ({ header }) => header.trim().toLowerCase(),
        strict: false
    }))
    .on('data', (row) => {
        count++;
        if (count % 1000 === 0) {
            console.log(`Processed ${count} rows...`);
        }
    })
    .on('end', () => {
        console.log('Final count with disabled quotes:', count);
        process.exit(0);
    });
