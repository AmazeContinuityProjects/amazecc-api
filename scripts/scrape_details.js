const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('C:/Users/sugee/.gemini/antigravity/brain/d1b2246f-cef5-479d-a3f7-5dd4a9a887c2/scratch/vit_faculty.html', 'utf8');
const $ = cheerio.load(html);

const facultyDetails = [];

$('.faculty-item, .vc_col-sm-3, .vc_col-sm-4, .staff-member, .team-member, article, figure').each((i, el) => {
    // Just looking for standard container classes or trying to find by text.
    // Actually, let's just find the first few h3/h4 tags and look at their parent structure!
});

// Let's print out the exact HTML structure of the first faculty member found
let found = false;
$('*').each((i, el) => {
    if (!found && $(el).text().trim().startsWith("Dr. Viswanathan V")) {
        // found the element containing the name. let's get its closest significant parent
        const parent = $(el).closest('.vc_row, .row, .col-md-3, .col-sm-4, div');
        console.log("HTML for first faculty:");
        console.log(parent.html());
        found = true;
    }
});
