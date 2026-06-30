import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT file_url, storage_provider FROM papers_archive 
       WHERE file_url != '' 
         AND file_url IS NOT NULL
         AND file_url != 'DIRECT_JSON'
         AND file_url NOT LIKE '%drive.google%'
         AND file_url NOT LIKE '%docs.google%'
         AND file_url NOT LIKE '%sharepoint%'
         AND file_url NOT LIKE '%onedrive%'
         AND file_url NOT LIKE '%dropbox%'
       LIMIT 20`
    );
    return NextResponse.json({ success: true, rows });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
