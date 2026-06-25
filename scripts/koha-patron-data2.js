const https = require('https');
const querystring = require('querystring');
const cheerio = require('cheerio');

const host = 'webopaccc.vit.ac.in';
const agent = new https.Agent({ rejectUnauthorized: false });

function request(method, path, postData, cookies, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
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
        const newCookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        const combined = newCookies || cookies;
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          request('GET', res.headers.location, null, combined, redirects + 1).then(resolve).catch(reject);
        } else {
          resolve({ status: res.statusCode, body: d, cookies: combined });
        }
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
  const cookies = loginResult.cookies;

  // Dashboard
  const dash = await request('GET', '/cgi-bin/koha/opac-user.pl', null, cookies);
  const $ = cheerio.load(dash.body);

  console.log('=== PATRON NAME ===');
  const allH3 = [];
  $('h3').each((i, el) => { const t = $(el).text().trim(); if (t && t.length < 80) allH3.push(t); });
  console.log(allH3.join('\n'));

  console.log('\n=== BORROWER DETAILS ===');
  $('div.borrower_detail').each((i, el) => console.log($(el).text().trim().slice(0, 300)));
  $('li.bor_detail').each((i, el) => console.log($(el).text().trim()));

  console.log('\n=== CHECKOUTS TABLE ===');
  const coHeaders = [];
  $('#checkouts_table thead th').each((i, el) => coHeaders.push($(el).text().trim()));
  console.log('Headers:', coHeaders.join(' | '));
  $('#checkouts_table tbody tr').each((i, row) => {
    const cells = $(row).find('td');
    const rowData = [];
    cells.each((j, cell) => rowData.push($(cell).text().trim().replace(/\s+/g, ' ').slice(0, 50)));
    if (rowData.length) console.log((i+1) + ': ' + rowData.slice(0, 3).join(' | '));
  });

  console.log('\n=== CHARGES SUMMARY ===');
  $('.patroninfo').each((i, el) => {
    const t = $(el).text().trim();
    if (t.includes('Due') || t.includes('Fine') || t.includes('charge') || t.includes('₹') || t.includes('$')) console.log(t.replace(/\s+/g, ' ').slice(0, 200));
  });
  $('.details').each((i, el) => {
    const t = $(el).text().trim();
    if (t.includes('Due') || t.includes('charge') || t.includes('fine') || t.includes('₹')) console.log(t.replace(/\s+/g, ' ').slice(0, 200));
  });
}

main().catch(console.error);
