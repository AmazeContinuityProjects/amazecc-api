import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { requireClubAuth } from '@/lib/clubAuth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const club_id = searchParams.get('club_id');
    const vtop_id = searchParams.get('vtop_id');
    let user_hash = '';
    if (vtop_id) {
        user_hash = crypto.createHash('sha256').update(vtop_id).digest('hex');
    }

    const pool = getDbPool();
    let query = `
      SELECT f.*, 
             (SELECT COUNT(*) FROM post_promotions p WHERE p.post_id = f.id) as promote_count
             ${user_hash ? `, (SELECT COUNT(*) > 0 FROM post_promotions p WHERE p.post_id = f.id AND p.user_hash = '${user_hash}') as has_promoted` : ', false as has_promoted'}
      FROM club_feed f
    `;
    let params: any[] = [];

    if (club_id) {
      query += ' WHERE f.club_id = $1';
      params.push(club_id);
    }
    
    query += ' ORDER BY f.created_at DESC';

    const { rows } = await pool.query(query, params);

    return NextResponse.json({ success: true, feed: rows });
  } catch (error) {
    console.error('Failed to fetch club feed:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireClubAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { content, links, image_urls, event_id } = await req.json();

    if (!content) {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 });
    }

    const pool = getDbPool();
    const { rows } = await pool.query(
      `INSERT INTO club_feed (club_id, event_id, content, links, image_urls, posted_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [auth.club_id, event_id || null, content, JSON.stringify(links || []), JSON.stringify(image_urls || []), auth.vtop_id]
    );

    return NextResponse.json({ success: true, post: rows[0] });
  } catch (error) {
    console.error('Failed to post to club feed:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireClubAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const post_id = searchParams.get('post_id');

    if (!post_id) {
      return NextResponse.json({ success: false, error: 'Post ID is required' }, { status: 400 });
    }

    const pool = getDbPool();
    // Ensure the post belongs to the authenticated user's club
    const { rowCount } = await pool.query(
      'DELETE FROM club_feed WHERE id = $1 AND club_id = $2',
      [post_id, auth.club_id]
    );

    if (!rowCount || rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Post not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete club feed post:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
