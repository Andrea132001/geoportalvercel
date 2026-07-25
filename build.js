const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL;
const key = process.env.API_KEY;

if (!url || !key) {
    console.error('ERROR: SUPABASE_URL and API_KEY environment variables are required.');
    process.exit(1);
}

const content = `var SUPABASE_URL='${url}';
var API_KEY='${key}';
`;

fs.writeFileSync(path.join(__dirname, 'config.js'), content, 'utf8');
console.log('config.js generated successfully.');
