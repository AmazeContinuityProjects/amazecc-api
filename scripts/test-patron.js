const http = require('http');
const data = JSON.stringify({ card: "25BLC1081", password: "VITOOUpgradeChennaiGod2007@#" });
const opts = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/koha/patron',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};
const req = http.request(opts, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try { console.log(JSON.stringify(JSON.parse(d), null, 2).slice(0, 3000)); } catch(e) { console.log(d.slice(0, 1000)); }
  });
});
req.write(data);
req.end();
