import fs from 'fs';
import readline from 'readline';

const filePath = 'F:/Project/Incometaxreturn/Data/real_data/customer.csv';

const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    terminal: false
});

rl.on('line', (line) => {
    fs.writeFileSync('csv_headers.txt', line);
    console.log('Headers written to csv_headers.txt');
    rl.close();
    process.exit(0);
});
