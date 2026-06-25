const https = require('https');
const url = 'https://webopaccc.vit.ac.in/cgi-bin/koha/opac-detail.pl?biblionumber=141';
https.get(url, { agent: new https.Agent({ rejectUnauthorized: false }), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AmazeCC/1.0)' } }, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const cheerio = require('cheerio');
    const $ = cheerio.load(d);
    
    console.log('=== TITLE ===');
    console.log($('h1').text().trim());
    
    console.log('=== AUTHOR ===');
    console.log($('.author').text().trim());
    
    console.log('=== ALL LABEL-VALUE PAIRS ===');
    $('.bib_detail .label').each((i, el) => {
      const label = $(el).text().trim();
      const value = $(el).siblings('.value').text().trim();
      if (label) console.log(label + ': ' + value);
    });
    
    console.log('=== PUBLISHER ===');
    $('.results_summary .label').each((i, el) => {
      const label = $(el).text().trim().replace(':', '');
      const value = $(el).parent().clone().children().remove().end().text().trim();
      if (label) console.log(label + ': ' + value);
    });
    
    console.log('=== HOLDINGS TABLE ===');
    $('table.items_table tr').each((i, row) => {
      const cols = $(row).find('td, th').map((j, c) => $(c).text().trim()).get();
      if (cols.length) console.log(cols.join(' | '));
    });
    
    console.log('=== SUBJECTS ===');
    $('.subjects a').each((i, el) => console.log($(el).text().trim()));
    
    console.log('=== IMAGE ===');
    console.log($('#bookcover img').attr('src') || $('.cover img').attr('src'));
    
    console.log('=== RAW HTML OF BIBLIO DETAIL SECTION ===');
    console.log($('.record').html()?.slice(0, 2000));
  });
}).on('error', e => console.error('Error:', e.message));
