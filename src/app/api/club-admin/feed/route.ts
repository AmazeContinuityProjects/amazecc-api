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
    const params: any[] = [];

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
    const data = await req.json();
    const { content, links, image_urls, event_id } = data;

    if (!content) {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 });
    }

    let club_id = auth.club_id;
    const pool = getDbPool();

    if (data.club_id && String(data.club_id).trim() !== String(auth.club_id).trim()) {
      const requestedClubId = String(data.club_id).trim();
      if (auth.role !== 'super-club-rep') {
        const { rowCount } = await pool.query(
          'SELECT 1 FROM club_representatives WHERE vtop_id = $1 AND club_id = $2',
          [auth.vtop_id, requestedClubId]
        );
        if (!rowCount) {
          return NextResponse.json({ success: false, error: 'Unauthorized for this club' }, { status: 403 });
        }
      }
      club_id = requestedClubId;
    }

    const { rows } = await pool.query(
      `INSERT INTO club_feed (club_id, event_id, content, links, image_urls, posted_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [club_id, event_id || null, content, JSON.stringify(links || []), JSON.stringify(image_urls || []), auth.vtop_id]
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

    if (auth.role === 'super-club-rep') {
      const { rowCount } = await pool.query(
        'DELETE FROM club_feed WHERE id = $1',
        [post_id]
      );
      if (!rowCount || rowCount === 0) {
        return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
      }
    } else {
      // Find the post's club_id and verify rep permission
      const postRes = await pool.query('SELECT club_id FROM club_feed WHERE id = $1', [post_id]);
      if (postRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
      }
      const postClubId = postRes.rows[0].club_id;
      
      const repCheck = await pool.query(
        'SELECT 1 FROM club_representatives WHERE vtop_id = $1 AND club_id = $2',
        [auth.vtop_id, postClubId]
      );
      if (repCheck.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Unauthorized to delete this post' }, { status: 403 });
      }

      await pool.query('DELETE FROM club_feed WHERE id = $1', [post_id]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete club feed post:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
