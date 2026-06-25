const https = require('https');
const url = 'https://webopaccc.vit.ac.in/cgi-bin/koha/opac-detail.pl?biblionumber=141';
https.get(url, { agent: new https.Agent({ rejectUnauthorized: false }), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AmazeCC/1.0)' } }, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    // Find holdings_panel content
    const matches = d.match(/<div[^>]*id="holdings_panel"[^>]*>[\s\S]*?<\/div>\s*<\/div>/i);
    if (matches) {
      console.log(matches[0].slice(0, 2000));
    } else {
      console.log('No holdings_panel found');
      // Search for anything with "items" in the HTML
      const itemMatches = d.match(/itemtype[\s\S]{0,300}/gi);
      if (itemMatches) console.log('Item matches:', itemMatches.slice(0, 3));
    }
  });
}).on('error', e => console.error('Error:', e.message));
