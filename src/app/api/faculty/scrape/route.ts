import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import * as cheerio from 'cheerio';
import https from 'https';

export const dynamic = 'force-dynamic';

interface RosterFaculty {
  id: string;
  name: string;
  designation: string;
  imageUrl: string;
  profileUrl: string;
  email: string;
  employeeId: string;
  intercom: string;
}

function fetchHtml(url: string, redirects = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    if (redirects > 3) {
      reject(new Error('Too many redirects'));
      return;
    }
    const req = https.get(url, { rejectUnauthorized: false, timeout: 10000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        fetchHtml(next, redirects + 1).then(resolve, reject);
        return;
      }
      const ctype = res.headers['content-type'] || '';
      if (!ctype.includes('html')) {
        res.resume();
        reject(new Error(`URL is not an HTML page (${ctype})`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', err => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('fetchHtml timeout')); });
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

    const faculties: RosterFaculty[] = [];

    $('article.exad-post-grid-three').each((i, el) => {
      const titleEl = $(el).find('a.exad-post-grid-title').first();
      const name = titleEl.text().trim();
      if (!name) return;

      const chennaiProfileUrl = titleEl.attr('href') || '';
      const designation = $(el).find('.exad-post-grid-category a').first().text().trim() || 'Faculty';
      const img = $(el).find('figure.exad-post-grid-thumbnail img').attr('src') || '';

      const idMatch = img.match(/(?:uploads\/\d{4}\/\d{2}\/)(\d{3,})/);
      const employeeId = idMatch ? idMatch[1] : '';
      const profileUrl = employeeId
        ? `https://directorycc.vit.ac.in/faculty/${employeeId}`
        : chennaiProfileUrl;

      faculties.push({
        id: employeeId || `temp-${i}`,
        name,
        designation,
        imageUrl: img,
        profileUrl,
        email: '',
        employeeId,
        intercom: ''
      });
    });

    if (faculties.length === 0) {
      // Fallback to the legacy VIT page layout
      $('.member-item, .staff-member, .vc_col-sm-3, .vc_col-sm-4').each((i, el) => {
        const nameEl = $(el).find('h3, h4').first();
        const name = nameEl.text().trim();
        if (!name) return;

        const designationEl = nameEl.next('h4, p, h5');
        const designation = designationEl.text().trim() || 'Faculty';
        const img = $(el).find('img').attr('src') || '';
        const profileUrl = $(el).find('a').first().attr('href') || '';
        const textContent = $(el).text();

        const emailMatch = textContent.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/);
        const empIdMatch = textContent.match(/Employee ID\s*(\d+)/i);
        const intercomMatch = textContent.match(/Intercom\s*([\d\s]+)/i);
        const employeeId = empIdMatch ? empIdMatch[1] : '';

        faculties.push({
          id: employeeId || `temp-${i}`,
          name,
          designation,
          imageUrl: img,
          profileUrl,
          email: emailMatch ? emailMatch[0] : '',
          employeeId,
          intercom: intercomMatch ? intercomMatch[1].trim() : ''
        });
      });
    }

    return NextResponse.json({ success: true, faculties });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('faculty/scrape error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
