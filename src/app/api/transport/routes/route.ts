import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getDbPool();
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
    }

    const { rows: routes } = await pool.query(`
      SELECT id, route_number, route_name, type,
        driver_name, driver_phone, whatsapp_group, bus_location,
        supervisor_name, supervisor_phone,
        stops, placements
      FROM buses_v2
      ORDER BY route_number::int, route_name
    `);

    return NextResponse.json({ success: true, routes });
  } catch (error: any) {
    console.error('Failed to fetch transport routes:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
