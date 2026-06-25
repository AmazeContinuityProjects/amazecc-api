const https = require('https');
const cheerio = require('cheerio');

const host = 'webopaccc.vit.ac.in';
const loginPath = '/cgi-bin/koha/opac-user.pl';
const postData = 'koha_login_context=opac&userid=test&password=test';

// First get login page for cookies
const req = https.get({ host, path: loginPath, agent: new https.Agent({ rejectUnauthorized: false }), headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
  const cookies = res.headers['set-cookie'] || [];
  console.log('Cookies:', cookies.map(c => c.split(';')[0]));
});
req.on('error', e => console.error(e));
