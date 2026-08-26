import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT id, school_name FROM faculty_directory_urls ORDER BY school_name ASC`
    );
    return NextResponse.json({ success: true, schools: rows });
  } catch (error: unknown) {
    console.error('faculty/schools error:', (error instanceof Error ? error.message : String(error)));
    return NextResponse.json({ success: false, schools: [], error: (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
