const fs = require('fs');
const xlsx = require('xlsx');

const dataDir = './data/';
let comments = [];

// Read all JSON files from the data directory
fs.readdirSync(dataDir).forEach(file => {
    if (file.endsWith('.json')) {
        const filePath = dataDir + file;
        const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        comments.push(fileData);
    }
});

// Prepare data for Excel
const worksheet = xlsx.utils.json_to_sheet(comments);
const workbook = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(workbook, worksheet, 'Comments');

// Write to Excel file
xlsx.writeFile(workbook, 'comments.xlsx');
console.log('Comments saved to comments.xlsx');
