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
  // Simple approach: just POST and use the body directly (since 303 has no body, we'll do a separate GET)
  const loginPage = await http('GET', '/cgi-bin/koha/opac-user.pl');
  const loginPageCookie = loginPage.cookies;
  
  const postData = querystring.stringify({
    koha_login_context: 'opac',
    userid: '25BLC1081',
    password: 'VITOOUpgradeChennaiGod2007@#'
  });
  const loginResult = await http('POST', '/cgi-bin/koha/opac-user.pl', postData, loginPageCookie);
  
  // Use the login result cookies (the CGISESSID)
  const sessionCookie = loginResult.cookies;
  console.log('Session cookie:', sessionCookie.slice(0, 60));
  
  // Now just GET the dashboard with these cookies
  const dash = await http('GET', '/cgi-bin/koha/opac-user.pl', null, sessionCookie);
  console.log('Dashboard status:', dash.status, 'length:', dash.body.length);
  
  const $ = cheerio.load(dash.body);
  
  console.log('\n=== TITLE ===');
  console.log($('title').text().trim());
  
  console.log('\n=== PATRON NAME ===');
  console.log($('#user-name').text().trim());
  console.log($('.patron-name').text().trim());
  console.log($('dd a[href*="opac-user"]').text().trim());
  
  console.log('\n=== NAV LINKS ===');
  $('a[href*="page="]').each((i, el) => {
    console.log($(el).text().trim(), '->', $(el).attr('href'));
  });
  
  console.log('\n=== SUMMARY SECTIONS ===');
  const sections = ['your_summary', 'your_charges', 'your_checkouts', 'opac-user-checkouts', 'checkout-summary'];
  sections.forEach(id => {
    const el = $('#' + id);
    if (el.length) console.log(id + ':', el.text().trim().replace(/\s+/g, ' ').slice(0, 300));
  });
  
  console.log('\n=== ALL TABLE IDS ===');
  $('table').each((i, el) => {
    const id = $(el).attr('id') || '';
    const caption = $(el).find('caption').text().trim() || $(el).prev().text().trim().slice(0, 40);
    if (id || caption) console.log(id, caption);
  });
}

main().catch(console.error);
