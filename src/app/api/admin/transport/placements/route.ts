import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.permissions.includes('transport') && !auth.permissions.includes('buses')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const pool = getDbPool();
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

export async function POST(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.permissions.includes('transport') && !auth.permissions.includes('buses')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const pool = getDbPool();
    const placements: { routeNumber: string; dispersalTime: string; zone: string }[] = await req.json();

    if (!Array.isArray(placements)) {
      return NextResponse.json({ success: false, error: 'Expected an array of placements' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE buses_v2 SET placements = '[]'::jsonb");

      const byRoute: Record<string, any[]> = {};
      for (const p of placements) {
        if (!byRoute[p.routeNumber]) byRoute[p.routeNumber] = [];
        byRoute[p.routeNumber].push({ dispersalTime: p.dispersalTime, zone: p.zone });
      }

      for (const [routeNumber, routePlacements] of Object.entries(byRoute)) {
        await client.query(
          'UPDATE buses_v2 SET placements = $1::jsonb, updated_at = now() WHERE route_number = $2',
          [JSON.stringify(routePlacements), routeNumber]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, message: 'Placements updated successfully' });
  } catch (error: any) {
    console.error('Failed to update placements:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
