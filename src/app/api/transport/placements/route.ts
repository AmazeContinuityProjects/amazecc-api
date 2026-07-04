import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getDbPool();
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
    }

    const { rows } = await pool.query(`
      SELECT id, route_number, route_name, type, placements
      FROM buses_v2
      WHERE jsonb_array_length(placements) > 0
      ORDER BY route_number::int
    `);
    const flat: any[] = [];
    for (const r of rows) {
      for (const p of r.placements || []) {
        flat.push({
          routeId: r.id,
          routeNumber: r.route_number,
          routeName: r.route_name,
          dispersalTime: p.dispersalTime,
          zone: p.zone,
        });
      }
    }
    flat.sort((a: any, b: any) => {
      if (a.dispersalTime !== b.dispersalTime) return a.dispersalTime < b.dispersalTime ? -1 : 1;
      return parseInt(a.routeNumber) - parseInt(b.routeNumber);
    });
    return NextResponse.json({ success: true, placements: flat });
  } catch (error: any) {
    console.error('Failed to fetch placements:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
