/**
 * @openapi
 * /api/admin/fresher-resources/[id]:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Auto-generated POST endpoint for /api/admin/fresher-resources/[id]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cookies:
 *                 type: string
 *               authorizedID:
 *                 type: string
 *               csrf:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 success: true
 *                 resource: "sample_value"
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await context.params;
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    const fields = await req.json();
    const allowed = ['title', 'description', 'url', 'icon', 'sort_order', 'is_active', 'type', 'content'];
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(fields[key]);
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    setClauses.push(`updated_at = now()`);
    values.push(numericId);

    const pool = getDbPool();
    const { rows } = await pool.query(
      `UPDATE fresher_resources SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, title, description, url, icon, sort_order, is_active, updated_at`,
      values
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Resource not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, resource: rows[0] });
  } catch (error: any) {
    console.error('admin fresher-resources PATCH error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await context.params;
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    const pool = getDbPool();
    const { rowCount } = await pool.query(
      'DELETE FROM fresher_resources WHERE id = $1',
      [numericId]
    );

    if (!rowCount || rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Resource not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('admin fresher-resources DELETE error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
