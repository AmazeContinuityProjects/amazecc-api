import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { requireClubAuth } from '@/lib/clubAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const club_id = searchParams.get('club_id');

    if (!club_id) {
      return NextResponse.json({ success: false, error: 'club_id is required' }, { status: 400 });
    }

    const pool = getDbPool();
    const { rows } = await pool.query(
      'SELECT * FROM club_details WHERE club_id = $1',
      [club_id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Club not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, details: rows[0] });
  } catch (error) {
    console.error('Failed to fetch club details:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireClubAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await req.json();
    let club_id = auth.club_id;
    
    const pool = getDbPool();

    if (data.club_id && data.club_id !== auth.club_id) {
      if (auth.role !== 'super-club-rep') {
        // verify the user actually represents this club
        const { rowCount } = await pool.query(
          'SELECT 1 FROM club_representatives WHERE vtop_id = $1 AND club_id = $2',
          [auth.vtop_id, data.club_id]
        );
        if (!rowCount) {
          return NextResponse.json({ success: false, error: 'Unauthorized for this club' }, { status: 403 });
        }
      }
      club_id = data.club_id;
    }
    
    const { mission, description, hiring_process, website, recruitment_link, instagram, whatsapp, poc, email, poc_phone } = data;
    
    // Check if exists
    const { rowCount } = await pool.query('SELECT club_id FROM club_details WHERE club_id = $1', [club_id]);
    
    if (rowCount && rowCount > 0) {
      await pool.query(
        `UPDATE club_details 
         SET mission = $1, description = $2, hiring_process = $3, website = $4, recruitment_link = $5, instagram = $6, whatsapp = $7, poc = $8, email = $9, poc_phone = $10, updated_at = CURRENT_TIMESTAMP
         WHERE club_id = $11`,
        [mission, description, hiring_process, website, recruitment_link, instagram, whatsapp, poc, email, poc_phone, club_id]
      );
    } else {
      await pool.query(
        `INSERT INTO club_details (club_id, club_name, mission, description, hiring_process, website, recruitment_link, instagram, whatsapp, poc, email, poc_phone)
         VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [club_id, mission, description, hiring_process, website, recruitment_link, instagram, whatsapp, poc, email, poc_phone]
      );
    }

    return NextResponse.json({ success: true, message: 'Details updated successfully' });
  } catch (error) {
    console.error('Failed to update club details:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
