const https = require('https');
const url = 'https://webopaccc.vit.ac.in/cgi-bin/koha/opac-user.pl';
https.get(url, { agent: new https.Agent({ rejectUnauthorized: false }), headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const match = d.match(/<form[^>]*opac-user[^>]*>[\s\S]*?<\/form>/i);
    if (match) console.log(match[0].slice(0, 3000));
    else console.log(d.slice(0, 2000));
  });
}).on('error', e => console.error(e.message));
