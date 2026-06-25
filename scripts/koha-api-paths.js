const https = require('https');
const querystring = require('querystring');

const host = 'webopaccc.vit.ac.in';
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });

function http(method, path, postData, cookies) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: host, path, method, agent,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Connection': 'close', 'Accept': 'application/json' }
    };
    if (cookies) opts.headers['Cookie'] = cookies;
    if (postData) {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      opts.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const newCookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        resolve({ status: res.statusCode, body: d, cookies: newCookies || cookies });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  // Login first
  const loginPage = await http('GET', '/cgi-bin/koha/opac-user.pl');
  const postData = querystring.stringify({
    koha_login_context: 'opac',
    userid: '25BLC1081',
    password: 'VITOOUpgradeChennaiGod2007@#'
  });
  const loginResult = await http('POST', '/cgi-bin/koha/opac-user.pl', postData, loginPage.cookies);
  const cookies = loginResult.cookies;

  // Try various API paths
  const paths = [
    '/api/v1/patrons',
    '/api/v1/patrons?cardnumber=25BLC1081',
    '/api/v1/public/patrons/me',
    '/api/v1/public/patrons/me/checkouts',
    '/api/v1/public/patrons/me/account',
    '/api/v1/opac/patrons/me',
    '/api/v1/opac/patrons/me/checkouts',
    '/api/v1/opac/patrons/me/account',
    '/api/v1/checkouts',
    '/api/v1/checkouts?patron_id=me',
    '/api/v1/holds',
    '/api/v1/account_lines',
    '/api/v1/patrons/me/account_lines',
    '/api/v1/public/patrons',
    '/api/v1/members',
    '/api/v1/members/me',
    '/api/v1/members/me/account',
    '/api/v1/members/me/checkouts',
    '/api/v1/users',
    '/api/v1/users/me',
    '/api/v1/users/me/loans',
    '/api/v1/users/me/fines',
    '/api/v1/loans',
    '/api/v1/fines',
  ];

  for (const p of paths) {
    const r = await http('GET', p, null, cookies);
    let summary = r.body.slice(0, 120).replace(/\n/g, ' ');
    try { const j = JSON.parse(r.body); summary = JSON.stringify(j).slice(0, 120); } catch(e) {}
    console.log(p, r.status, summary);
  }
}

main().catch(console.error);
