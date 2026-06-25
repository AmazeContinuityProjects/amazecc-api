const https = require('https');
const querystring = require('querystring');
const cheerio = require('cheerio');

const host = 'webopaccc.vit.ac.in';
const agent = new https.Agent({ rejectUnauthorized: false });

function request(method, path, postData, cookies) {
  return new Promise((resolve, reject) => {
    const opts = {
      host, path, method, agent,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookies || '' }
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
        resolve({ status: res.statusCode, body: d, cookies: setCookie, location: res.headers.location });
      });
    });
    if (postData) req.write(postData);
    req.end();
    req.on('error', reject);
  });
}

async function main() {
  // Login
  const loginPage = await request('GET', '/cgi-bin/koha/opac-user.pl');
  const postData = querystring.stringify({
    koha_login_context: 'opac',
    userid: '25BLC1081',
    password: 'VITOOUpgradeChennaiGod2007@#'
  });
  const loginResult = await request('POST', '/cgi-bin/koha/opac-user.pl', postData, loginPage.cookies);
  const cookies = loginResult.cookies || loginPage.cookies;

  // If 303, follow redirect
  if (loginResult.status === 303 && loginResult.location) {
    const redirected = await request('GET', loginResult.location, null, cookies);
    cookies = redirected.cookies || cookies;
  }

  // Check dashboard
  const dash = await request('GET', '/cgi-bin/koha/opac-user.pl', null, cookies);
  const $ = cheerio.load(dash.body);

  // Get patron name
  console.log('=== PATRON NAME ===');
  console.log($('h3 a[href*="opac-user"]').text().trim());
  console.log($('.patron-name').text().trim());
  
  // Get summary sections
  console.log('=== SUMMARY PANELS ===');
  $('.row[id^="user-info-"]').each((i, el) => {
    console.log($(el).text().trim().slice(0, 200));
  });
  
  // Checkout info
  console.log('=== CHECKOUTS ===');
  $('#checkouts_table tbody tr').each((i, row) => {
    const cells = $(row).find('td');
    console.log($(cells[0]).text().trim(), '|', $(cells[1]).text().trim(), '|', $(cells[2]).text().trim());
  });
  
  // Fines/charges
  console.log('=== CHARGES ===');
  $('.patroninfo a[href*="your_charges"]').parent().text().trim().split('\n').forEach(l => console.log(l.trim()));
  $('.your_charges').each((i, el) => console.log($(el).text().trim()));
  
  // All panels
  console.log('=== ALL SECTION HEADERS ===');
  $('h3').each((i, el) => {
    const h = $(el).text().trim();
    if (h && h.length < 100) console.log(h);
  });
}

main().catch(console.error);
