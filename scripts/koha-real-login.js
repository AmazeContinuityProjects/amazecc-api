const https = require('https');
const querystring = require('querystring');

const host = 'webopaccc.vit.ac.in';
const agent = new https.Agent({ rejectUnauthorized: false });

function request(method, path, postData, cookies) {
  return new Promise((resolve, reject) => {
    const opts = {
      host, path, method, agent,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Cookie': cookies || ''
      }
    };
    if (postData) {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      opts.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const setCookie = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        resolve({ status: res.statusCode, body: d, cookies: setCookie });
      });
    });
    if (postData) req.write(postData);
    req.end();
    req.on('error', reject);
  });
}

async function main() {
  // Step 1: Get CSRF + initial cookie from login page
  const loginPage = await request('GET', '/cgi-bin/koha/opac-user.pl');
  console.log('Initial cookies:', loginPage.cookies.slice(0, 100));
  
  // Step 2: Login with real credentials
  const postData = querystring.stringify({
    koha_login_context: 'opac',
    userid: '25BLC1081',
    password: 'VITOOUpgradeChennaiGod2007@#'
  });
  
  const loginResult = await request('POST', '/cgi-bin/koha/opac-user.pl', postData, loginPage.cookies);
  console.log('Login status:', loginResult.status, 'Cookies:', loginResult.cookies.slice(0, 100));
  console.log('Has error:', loginResult.body.includes('Login error') || loginResult.body.includes('incorrect') || loginResult.body.includes('auth_error'));
  console.log('Response length:', loginResult.body.length);
  
  const sessionCookie = loginResult.cookies || loginPage.cookies;
  
  // Step 3: Try API endpoints with session cookie
  const endpoints = [
    '/api/v1/patrons/me',
    '/api/v1/patrons/me/account',
    '/api/v1/public/biblios/141/items',
  ];
  
  for (const ep of endpoints) {
    const r = await request('GET', ep, null, sessionCookie);
    console.log(ep, r.status, r.body.slice(0, 200));
  }
  
  // Step 4: Check if logged-in page shows patron name
  const dash = await request('GET', '/cgi-bin/koha/opac-user.pl', null, sessionCookie);
  const nameMatch = dash.body.match(/welcome.*?([A-Z\s]+)/i);
  console.log('Patron name from page:', nameMatch ? nameMatch[1].trim() : 'not found');
}

main().catch(console.error);
