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
    const flat: Array<Record<string, unknown>> = [];
    for (const r of rows) {
      for (const p of ((r as Record<string, unknown>).placements as Array<Record<string, unknown>> | undefined) || []) {
        flat.push({
          routeId: (r as Record<string, unknown>).id as string,
          routeNumber: (r as Record<string, unknown>).route_number as string,
          routeName: (r as Record<string, unknown>).route_name as string,
          dispersalTime: p.dispersalTime as string,
          zone: p.zone as string,
        });
      }
    }
    flat.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      if ((a.dispersalTime as string) !== (b.dispersalTime as string)) return (a.dispersalTime as string) < (b.dispersalTime as string) ? -1 : 1;
      return parseInt(a.routeNumber as string) - parseInt(b.routeNumber as string);
    });
    return NextResponse.json({ success: true, placements: flat });
  } catch (error: unknown) {
    console.error('Failed to fetch placements:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
