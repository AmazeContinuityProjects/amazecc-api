const https = require('https');
const fs = require('fs');
const url = 'https://webopaccc.vit.ac.in/api/v1';
const opts = { agent: new https.Agent({ rejectUnauthorized: false }), headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } };
https.get(url, opts, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const spec = JSON.parse(d);
      const allPaths = Object.keys(spec.paths || {}).sort().map(p => {
        const methods = Object.keys(spec.paths[p]).filter(m => ['get','post','put','delete','patch'].includes(m));
        return p + ' [' + methods.join(',') + ']';
      });
      console.log(allPaths.join('\n'));
    } catch(e) {
      console.log('Parse error:', e.message);
      console.log('Response:', d.slice(0, 500));
    }
  });
}).on('error', e => console.error(e.message));
