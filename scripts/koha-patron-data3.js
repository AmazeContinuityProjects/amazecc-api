const https = require('https');
const querystring = require('querystring');
const cheerio = require('cheerio');

const host = 'webopaccc.vit.ac.in';
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });

function http(method, path, postData, cookies) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: host, path, method,
      agent,
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
        resolve({ status: res.statusCode, body: d, cookies: newCookies || cookies, location: res.headers.location });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  // Login
  const loginPage = await http('GET', '/cgi-bin/koha/opac-user.pl');
  console.log('Login page status:', loginPage.status);
  
  const postData = querystring.stringify({
    koha_login_context: 'opac',
    userid: '25BLC1081',
    password: 'VITOOUpgradeChennaiGod2007@#'
  });
  const loginResult = await http('POST', '/cgi-bin/koha/opac-user.pl', postData, loginPage.cookies);
  console.log('Login result status:', loginResult.status, 'Location:', loginResult.location);
  
  const cookies = loginResult.cookies;
  console.log('Cookies:', cookies.slice(0, 80));
  
  // Follow redirect to get dashboard
  if (loginResult.location) {
    const dash = await http('GET', loginResult.location, null, cookies);
    const $ = cheerio.load(dash.body);
    
    console.log('=== DASHBOARD TITLE ===');
    console.log($('title').text().trim());
    
    console.log('\n=== H3 HEADINGS ===');
    $('h3').each((i, el) => {
      const t = $(el).text().trim();
      if (t) console.log(t);
    });
    
    // Check patron name
    console.log('\n=== PATRON NAME ===');
    console.log($('dd a[href*="opac-user"]').text().trim());
    console.log($('.patron-name').text().trim());
    console.log($('#user-name').text().trim());
    
    // Checkout section
    console.log('\n=== CHECKOUTS ===');
    console.log($('#opac-user-checkouts').text().trim().slice(0, 500));
    
    // Charges
    console.log('\n=== CHARGES ===');
    const chargesText = dash.body.match(/your_charges[\s\S]{0,300}/i);
    if (chargesText) console.log(chargesText[0]);
    
    // Full content areas
    console.log('\n=== ALL PANELS ===');
    $('.row.panel').each((i, el) => {
      console.log('Panel:', $(el).text().trim().slice(0, 200).replace(/\s+/g, ' '));
      console.log('---');
    });
    
    // Search for patron detail links
    console.log('\n=== NAV LINKS ===');
    $('ul.nav-list a, a[href*="page="]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (text && text.length < 60) console.log(text, '->', href);
    });
  }
}

main().catch(console.error);
