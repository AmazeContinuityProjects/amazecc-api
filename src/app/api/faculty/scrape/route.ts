import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import * as cheerio from 'cheerio';
import https from 'https';

export const dynamic = 'force-dynamic';

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', err => reject(err));
  });
}

export async function POST(req: Request) {
  try {
    const { schoolId } = await req.json();
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'schoolId is required' }, { status: 400 });
    }

    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT url FROM faculty_directory_urls WHERE id = $1`,
      [schoolId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'School not found' }, { status: 404 });
    }

    const url = rows[0].url;
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    const faculties: any[] = [];

    // Parse the HTML
    // Based on VIT Chennai faculty page structure
    $('.member-item, .staff-member, .vc_col-sm-3, .vc_col-sm-4').each((i, el) => {
      // Find the name
      const nameEl = $(el).find('h3, h4').first();
      const name = nameEl.text().trim();
      
      if (!name) return;
      if (!(name.toLowerCase().includes('dr.') || name.toLowerCase().includes('mr.') || name.toLowerCase().includes('ms.'))) {
          // Sometimes it grabs wrong blocks, so ensure it looks like a name
          return;
      }

      // Find the designation
      const designationEl = nameEl.next('h4, p, h5');
      const designation = designationEl.text().trim() || 'Faculty';

      // Find image
      const img = $(el).find('img').attr('src') || '';

      // Find profile url
      const profileUrl = $(el).find('a').first().attr('href') || '';

      // Extract details from text content
      const textContent = $(el).text();
      
      const emailMatch = textContent.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/);
      const email = emailMatch ? emailMatch[0] : '';

      const empIdMatch = textContent.match(/Employee ID\s*(\d+)/i);
      const employeeId = empIdMatch ? empIdMatch[1] : '';

      const intercomMatch = textContent.match(/Intercom\s*([\d\s]+)/i);
      const intercom = intercomMatch ? intercomMatch[1].trim() : '';

      faculties.push({
        id: employeeId || `temp-${i}`, // fallback id
        name,
        designation,
        imageUrl: img,
        profileUrl,
        email,
        employeeId,
        intercom
      });
    });

    return NextResponse.json({ success: true, faculties });

  } catch (error: any) {
    console.error('faculty/scrape error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
