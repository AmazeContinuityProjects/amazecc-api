import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { requireClubAuth } from '@/lib/clubAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireClubAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getDbPool();
    const { rows } = await pool.query(
      'SELECT id, vtop_id, role, created_at FROM club_representatives WHERE club_id = $1',
      [auth.club_id]
    );

    return NextResponse.json({ success: true, reps: rows, isSuperRep: auth.role === 'super-club-rep' });
  } catch (error) {
    console.error('Failed to fetch club reps:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireClubAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== 'super-club-rep') {
    return NextResponse.json({ success: false, error: 'Unauthorized: Only super-club-reps can add reps' }, { status: 403 });
  }

  try {
    const { vtop_id, role } = await req.json();

    if (!vtop_id) {
      return NextResponse.json({ success: false, error: 'vtop_id is required' }, { status: 400 });
    }

    const newRole = role === 'super-club-rep' ? 'super-club-rep' : 'representative';
    const pool = getDbPool();
    
    // Upsert the rep
    await pool.query(
      `INSERT INTO club_representatives (club_id, vtop_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (club_id, vtop_id) DO UPDATE SET role = $3`,
      [auth.club_id, vtop_id.toUpperCase(), newRole]
    );

    return NextResponse.json({ success: true, message: 'Representative added/updated successfully' });
  } catch (error) {
    console.error('Failed to add club rep:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireClubAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== 'super-club-rep') {
    return NextResponse.json({ success: false, error: 'Unauthorized: Only super-club-reps can remove reps' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const vtop_id = searchParams.get('vtop_id');

    if (!vtop_id) {
      return NextResponse.json({ success: false, error: 'vtop_id is required' }, { status: 400 });
    }

    if (vtop_id.toUpperCase() === auth.vtop_id.toUpperCase()) {
      return NextResponse.json({ success: false, error: 'Cannot remove yourself' }, { status: 400 });
    }

    const pool = getDbPool();
    await pool.query(
      'DELETE FROM club_representatives WHERE club_id = $1 AND vtop_id = $2',
      [auth.club_id, vtop_id.toUpperCase()]
    );

    return NextResponse.json({ success: true, message: 'Representative removed successfully' });
  } catch (error) {
    console.error('Failed to remove club rep:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
