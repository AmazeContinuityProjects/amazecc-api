import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getDbPool();
    const { rows: nonHttp } = await pool.query(
      `SELECT file_url, storage_provider FROM papers_archive WHERE file_url NOT LIKE 'http%' LIMIT 10`
    );
    const { rows: r2Papers } = await pool.query(
      `SELECT file_url, storage_provider FROM papers_archive WHERE storage_provider = 'R2' LIMIT 10`
    );
    const { rows: anyPapers } = await pool.query(
      `SELECT file_url, storage_provider FROM papers_archive LIMIT 10`
    );
    return NextResponse.json({ success: true, nonHttp, r2Papers, anyPapers });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
