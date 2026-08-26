import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { ensureAuditLogsTable } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit-logs
 * Retrieves administrative audit logs with optional filtering.
 */
export async function GET(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getDbPool();
    await ensureAuditLogsTable();

    const { searchParams } = new URL(req.url);
    const user = searchParams.get('user');
    const action = searchParams.get('action');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (user) {
      conditions.push(`admin_user ILIKE $${idx++}`);
      values.push(`%${user.trim()}%`);
    }

    if (action) {
      conditions.push(`action ILIKE $${idx++}`);
      values.push(`%${action.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit);

    const { rows } = await pool.query(
      `SELECT id, admin_user, action, target_resource, details, ip_address, user_agent, created_at AS timestamp
       FROM admin_audit_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
      values
    );

    return NextResponse.json({
      success: true,
      logs: rows
    });
  } catch (error: unknown) {
    console.error('admin/audit-logs GET error:', (error instanceof Error ? error.message : String(error)));
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
