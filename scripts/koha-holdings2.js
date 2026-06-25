const https = require('https');
const url = 'https://webopaccc.vit.ac.in/cgi-bin/koha/opac-detail.pl?biblionumber=141';
https.get(url, { agent: new https.Agent({ rejectUnauthorized: false }), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AmazeCC/1.0)' } }, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    // Find any section containing "holdings" or "items"
    const matches = d.match(/<table[^>]*items[^>]*>[\s\S]*?<\/table>/gi);
    if (matches) {
      matches.forEach((m, i) => {
        console.log(`=== TABLE ${i} ===`);
        console.log(m.slice(0, 1500));
      });
    } else {
      console.log('No items table found');
      // Search for holdings section
      const holdMatch = d.match(/Holdings[\s\S]{0,500}/i);
      if (holdMatch) console.log('Holdings section:', holdMatch[0]);
    }
  });
}).on('error', e => console.error('Error:', e.message));
