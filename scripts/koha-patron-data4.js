const https = require('https');
const querystring = require('querystring');
const cheerio = require('cheerio');

const host = 'webopaccc.vit.ac.in';
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });

function http(method, path, postData, cookies) {
  return new Promise((resolve, reject) => {
    const fullPath = path.startsWith('http') ? new URL(path).pathname + new URL(path).search : path;
    const opts = {
      hostname: host, path: fullPath, method, agent,
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
        const newCookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        const combined = newCookies || cookies;
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location.startsWith('http') ? res.headers.location : '/cgi-bin/koha/' + res.headers.location;
          console.log('Redirect to:', loc);
          http('GET', loc, null, combined).then(resolve).catch(reject);
        } else {
          resolve({ status: res.statusCode, body: d, cookies: combined });
        }
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
  const cookies = loginResult.cookies || loginPage.cookies;

  const dash = await http('GET', '/cgi-bin/koha/opac-user.pl', null, cookies);
  const $ = cheerio.load(dash.body);

  console.log('=== NAV LINKS ===');
  $('a[href*="page="]').each((i, el) => {
    const h = $(el).attr('href');
    const t = $(el).text().trim();
    if (t && t.length < 60) console.log(t, '->', h);
  });

  console.log('\n=== BORROWER INFO ===');
  $('ul.bor_detail li, .borrower_detail li').each((i, el) => {
    const t = $(el).text().trim();
    if (t) console.log(t.replace(/\s+/g, ' '));
  });

  console.log('\n=== SUMMARY PANELS ===');
  $('.row h3, .panel h3, [class*="panel"] h3').each((i, el) => {
    const t = $(el).text().trim();
    if (t) console.log(t);
  });

  console.log('\n=== ISSUES/CHECKOUTS ===');
  const coText = dash.body.match(/<table[^>]*checkouts[^>]*>[\s\S]*?<\/table>/i);
  if (coText) console.log(coText[0].slice(0, 1000));
}

main().catch(console.error);
