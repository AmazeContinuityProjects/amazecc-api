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

  const dash = await http('GET', '/cgi-bin/koha/opac-user.pl', null, cookies);
  const $ = cheerio.load(dash.body);

  // List all tab panes
  console.log('=== TAB PANELS ===');
  $('.tab-pane').each((i, el) => {
    const id = $(el).attr('id') || '';
    console.log('Pane #' + i + ': id=' + id + ' content=' + $(el).text().trim().replace(/\s+/g, ' ').slice(0, 150));
  });

  // List all nav tabs/links
  console.log('\n=== NAV TABS ===');
  $('.nav-tabs a, .nav-link, [data-toggle="tab"]').each((i, el) => {
    const href = $(el).attr('href') || $(el).data('target') || '';
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text) console.log(text, '->', href);
  });

  // Menu links
  console.log('\n=== USER MENU ITEMS ===');
  $('.usermenu a, .nav-item a').each((i, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text && text.length < 60) console.log(text, '->', href);
  });
  
  // Find patron details
  console.log('\n=== PERSONAL DETAILS SECTION ===');
  console.log(dash.body.match(/<div[^>]*personal[^>]*>[\s\S]{0,1000}/i)?.[0]?.slice(0, 500) || 'not found');
  console.log(dash.body.match(/<div[^>]*your_details[^>]*>[\s\S]{0,1000}/i)?.[0]?.slice(0, 500) || 'not found');
}

main().catch(console.error);
