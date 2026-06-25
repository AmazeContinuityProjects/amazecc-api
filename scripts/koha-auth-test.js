const https = require('https');
const querystring = require('querystring');

// Step 1: Get login page for CSRF token / cookies
const host = 'webopaccc.vit.ac.in';
const agent = new https.Agent({ rejectUnauthorized: false });

function getPage(path, cookies) {
  return new Promise((resolve, reject) => {
    const opts = {
      host, path, agent,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookies || '' }
    };
    https.get(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const setCookie = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        resolve({ status: res.statusCode, body: d, cookies: setCookie });
      });
    }).on('error', reject);
  });
}

async function main() {
  // Step 1: Get initial cookies
  const loginPage = await getPage('/cgi-bin/koha/opac-user.pl');
  console.log('Login page status:', loginPage.status, 'Cookies:', loginPage.cookies.slice(0, 80));
  
  // Step 2: Try logging in (we don't have real credentials, just see if the flow works)
  const postData = querystring.stringify({
    koha_login_context: 'opac',
    userid: 'GUEST',
    password: 'guest'
  });
  
  const loginOpts = {
    host, agent,
    path: '/cgi-bin/koha/opac-user.pl',
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
      'Cookie': loginPage.cookies
    }
  };
  
  const loginResult = await new Promise((resolve, reject) => {
    const req = https.request(loginOpts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const setCookie = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        resolve({ status: res.statusCode, cookies: setCookie, bodyLength: d.length, hasLoginError: d.includes('Login error') || d.includes('incorrect') });
      });
    });
    req.write(postData);
    req.end();
    req.on('error', reject);
  });
  
  console.log('Login result status:', loginResult.status, 'Cookies:', loginResult.cookies.slice(0, 80));
  console.log('Has login error:', loginResult.hasLoginError);
  
  // Step 3: Now try API with these cookies
  if (loginResult.cookies) {
    const apiResult = await getPage('/api/v1/patrons/me', loginResult.cookies);
    console.log('API /patrons/me status:', apiResult.status);
    console.log('API response:', apiResult.body.slice(0, 500));
  }
  
  // Check available API endpoints with cookie
  const apiPaths = ['/api/v1/patrons/me', '/api/v1/patrons/me/account', '/api/v1/patrons/me/checkouts', '/api/v1/public/biblios/141/items'];
  for (const p of apiPaths) {
    const r = await getPage(p, loginResult.cookies || loginPage.cookies);
    console.log(p, r.status, r.body.slice(0, 100));
  }
}

main().catch(console.error);
