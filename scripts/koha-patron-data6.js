const https = require('https');
const querystring = require('querystring');
const cheerio = require('cheerio');

const host = 'webopaccc.vit.ac.in';
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });

function http(method, path, postData, cookies) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: host, path, method, agent,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Connection': 'close' }
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
        const setCookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        resolve({ status: res.statusCode, body: d, cookies: setCookies, location: res.headers.location });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  const loginPage = await http('GET', '/cgi-bin/koha/opac-user.pl');
  const postData = querystring.stringify({
    koha_login_context: 'opac',
    userid: '25BLC1081',
    password: 'VITOOUpgradeChennaiGod2007@#'
  });
  const loginResult = await http('POST', '/cgi-bin/koha/opac-user.pl', postData, loginPage.cookies);
  const sessionCookie = loginResult.cookies;

  const dash = await http('GET', '/cgi-bin/koha/opac-user.pl', null, sessionCookie);
  const $ = cheerio.load(dash.body);

  console.log('=== LOGIN FORM ===');
  const loginForm = $('#auth');
  console.log('Login form present:', loginForm.length > 0);
  
  console.log('\n=== LOGOUT LINK ===');
  $('a[href*="logout"]').each((i, el) => console.log($(el).text().trim(), $(el).attr('href')));

  console.log('\n=== ALL CLASSES WITH "user" OR "patron" ===');
  $('[class*="user"],[class*="patron"],[class*="borrow"],[id*="user"],[id*="patron"],[id*="borrow"]').each((i, el) => {
    const tag = el.name;
    const cls = $(el).attr('class') || '';
    const id = $(el).attr('id') || '';
    const txt = $(el).text().trim().slice(0, 80);
    if (txt) console.log(tag, id, cls, ':', txt.replace(/\n/g, ' '));
  });

  console.log('\n=== USER GREETING OR ANY WELCOME TEXT ===');
  const bodyText = $('body').text();
  const welcomeMatch = bodyText.match(/Welcome[^.]*\./i);
  if (welcomeMatch) console.log(welcomeMatch[0]);
  
  const loggedMatch = bodyText.match(/You are logged in[^<]*/i);
  if (loggedMatch) console.log(loggedMatch[0]);

  console.log('\n=== ALL H3 TEXT ===');
  $('h3').each((i, el) => {
    const t = $(el).text().trim();
    if (t) console.log(t);
  });

  console.log('\n=== PATRON NAME SEARCH IN HTML ===');
  // Search for patron card number
  if (dash.body.includes('25BLC1081')) console.log('Card number found in page');
  if (dash.body.includes('SUGEETH')) console.log('Name found in page');
  
  // Dump a section around "SUGEETH" or card
  const idx = dash.body.indexOf('SUGEETH');
  if (idx > -1) console.log('Context around SUGEETH:', dash.body.slice(Math.max(0, idx-100), idx+200));
}

main().catch(console.error);
