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
        resolve({ status: res.statusCode, body: d, cookies: setCookies });
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
  const cookies = loginResult.cookies;

  const pages = [
    'your_summary',
    'your_charges',
    'your_details',
    'your_tags',
    'change_password',
    'your_search_history',
    'your_checkouts',
    'your_purchase_suggestions',
    'your_messaging',
    'your_lists',
  ];

  for (const page of pages) {
    const r = await http('GET', '/cgi-bin/koha/opac-user.pl?page=' + page, null, cookies);
    const $ = cheerio.load(r.body);
    
    // Get main content area
    let content = $('#userdetails, .userdetails, .maincontent').text().trim().replace(/\s+/g, ' ').slice(0, 300);
    console.log('=== ' + page + ' (status:' + r.status + ') ===');
    console.log(content);
    console.log('');
  }
}

main().catch(console.error);
