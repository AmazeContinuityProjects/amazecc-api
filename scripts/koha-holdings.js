const https = require('https');
const url = 'https://webopaccc.vit.ac.in/cgi-bin/koha/opac-detail.pl?biblionumber=141';
https.get(url, { agent: new https.Agent({ rejectUnauthorized: false }), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AmazeCC/1.0)' } }, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const cheerio = require('cheerio');
    const $ = cheerio.load(d);

    // Holdings
    const holdings = [];
    $('#items_table_container table.items_table tr').each((i, row) => {
      if (i === 0) return; // skip header
      const cells = $(row).find('td');
      if (cells.length === 0) return;
      holdings.push({
        type: $(cells[0]).text().trim(),
        currentLib: $(cells[1]).text().trim(),
        homeLib: $(cells[2]).text().trim(),
        shelving: $(cells[3]).text().trim(),
        callNumber: $(cells[4]).text().trim(),
        status: $(cells[5]).text().trim().replace(/\s+/g, ' '),
        notes: $(cells[6]).text().trim(),
        dueDate: $(cells[7]).text().trim(),
      });
    });
    console.log(JSON.stringify(holdings, null, 2));

    console.log('---');

    // Also check the table HTML structure
    console.log($('#items_table_container').html()?.slice(0, 2000));
  });
}).on('error', e => console.error('Error:', e.message));
