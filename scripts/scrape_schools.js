const cheerio = require('cheerio');

async function scrapeAllSchools() {
  try {
    const res = await fetch('https://chennai.vit.ac.in/', { agent: new (require('https').Agent)({ rejectUnauthorized: false }) });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // The main menu usually contains links to all schools
    const links = new Set();
    $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('chennai.vit.ac.in') && href.includes('engineering') && !href.includes('faculty')) {
            // let's just grab hrefs that look like school URLs
            links.add(href);
        }
    });
    
    console.log(Array.from(links));
  } catch (e) {
    console.error(e);
  }
}

scrapeAllSchools();
