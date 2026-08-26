import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { requireAdminAuth, hasAdminPermission } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT id, title, description, url, icon, sort_order, is_active, type, content, created_at, updated_at
       FROM fresher_resources
       ORDER BY sort_order ASC, id ASC`
    );
    return NextResponse.json({ success: true, resources: rows });
  } catch (error: unknown) {
    console.error('admin fresher-resources GET error:', (error instanceof Error ? error.message : String(error)));
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!hasAdminPermission(auth, 'fresher-resources')) {
    return NextResponse.json(
      { success: false, error: 'Permission denied: fresher-resources permission required' },
      { status: 403 }
    );
  }

  try {
    const { title, description, url, icon, sort_order, is_active, type, content } = await req.json();
    if (!title) {
      return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
    }
    const resourceType = type || 'link';
    if (resourceType === 'link' && !url) {
      return NextResponse.json({ success: false, error: 'url is required for link type resources' }, { status: 400 });
    }
    const pool = getDbPool();
    const { rows } = await pool.query(
      `INSERT INTO fresher_resources (title, description, url, icon, sort_order, is_active, type, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, description, url, icon, sort_order, is_active, type, content, created_at`,
      [title, description || '', resourceType === 'link' ? url : null, icon || 'ExternalLink', sort_order ?? 0, is_active ?? true, resourceType, content || '']
    );

    await logAdminAction({
      admin_user: auth.username,
      action: 'Create Fresher Resource',
      target_resource: `/api/admin/fresher-resources/${rows[0].id}`,
      details: { id: rows[0].id, title, type: resourceType }
    });

    return NextResponse.json({ success: true, resource: rows[0] });
  } catch (error: unknown) {
    console.error('admin fresher-resources POST error:', (error instanceof Error ? error.message : String(error)));
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
