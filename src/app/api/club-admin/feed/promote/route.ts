import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { post_id, vtop_id } = await req.json();

    if (!post_id || !vtop_id) {
      return NextResponse.json({ success: false, error: 'post_id and vtop_id are required' }, { status: 400 });
    }

    const user_hash = crypto.createHash('sha256').update(vtop_id).digest('hex');
    const pool = getDbPool();

    // Check if already promoted
    const { rowCount } = await pool.query(
      'SELECT id FROM post_promotions WHERE post_id = $1 AND user_hash = $2',
      [post_id, user_hash]
    );

    if (rowCount > 0) {
      // Remove promotion (toggle behavior)
      await pool.query(
        'DELETE FROM post_promotions WHERE post_id = $1 AND user_hash = $2',
        [post_id, user_hash]
      );
      return NextResponse.json({ success: true, promoted: false });
    } else {
      // Add promotion
      await pool.query(
        'INSERT INTO post_promotions (post_id, user_hash) VALUES ($1, $2)',
        [post_id, user_hash]
      );
      return NextResponse.json({ success: true, promoted: true });
    }
  } catch (error) {
    console.error('Failed to promote post:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
