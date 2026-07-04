import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const pool = getDbPool();
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
    }

    const { id: routeId } = await params;
    const id = parseInt(routeId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid route ID' }, { status: 400 });
    }

    const { rows: routes } = await pool.query('SELECT * FROM buses_v2 WHERE id = $1', [id]);
    if (routes.length === 0) {
      return NextResponse.json({ success: false, error: 'Route not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      route: routes[0],
    });
  } catch (error: any) {
    console.error('Failed to fetch route:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
