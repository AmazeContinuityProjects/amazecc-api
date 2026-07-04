import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getDbPool();
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
    }

    const { rows } = await pool.query('SELECT * FROM transport_rules ORDER BY rule_number');
    return NextResponse.json({ success: true, rules: rows });
  } catch (error: any) {
    console.error('Failed to fetch transport rules:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
