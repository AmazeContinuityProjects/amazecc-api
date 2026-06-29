const cheerio = require('cheerio');

async function scrapeFaculty(url) {
  try {
    console.log("Fetching", url);
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const faculties = [];
    
    // VIT Chennai website usually uses rows or specific classes for faculty
    // Let's print out the classes of elements that contain "Ramesh" to see the structure
    $('*').each((i, el) => {
        if ($(el).text().includes("Ramesh") && $(el).children().length === 0) {
            console.log("Found Ramesh in tag:", el.tagName, "with classes:", $(el).attr('class'));
        }
    });

    // We can also try to find all <h3> or <h4> which often contain names
    $('h3, h4').each((i, el) => {
        const text = $(el).text().trim();
        if (text.toLowerCase().includes('dr.') || text.toLowerCase().includes('mr.') || text.toLowerCase().includes('ms.')) {
            faculties.push(text);
        }
    });
    
    console.log(`Found ${faculties.length} faculties by title heuristics.`);
    console.log(faculties.slice(0, 10));
    
  } catch (e) {
    console.error(e);
  }
}

scrapeFaculty('https://chennai.vit.ac.in/computer-science-engineering-chennai/faculty/');
