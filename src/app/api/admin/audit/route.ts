import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function ensureAuditTable(pool: any) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id TEXT PRIMARY KEY,
      admin_user TEXT NOT NULL,
      admin_role TEXT,
      action TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      target_resource TEXT NOT NULL,
      details TEXT NOT NULL,
      diff JSONB,
      status TEXT DEFAULT 'info',
      action_needed TEXT,
      fix_status TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user ON admin_audit_logs (admin_user);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON admin_audit_logs (category);
  `).catch((err: any) => {
    console.error('Failed to ensure admin_audit_logs table:', err);
  });
}

/**
 * GET /api/admin/audit - Retrieve administrative audit logs
 */
export async function GET(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getDbPool();
    await ensureAuditTable(pool);

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const adminUser = searchParams.get('admin_user');
    const status = searchParams.get('status');
    const query = searchParams.get('q');
    const limit = Math.min(Number(searchParams.get('limit')) || 200, 1000);

    let sql = 'SELECT * FROM admin_audit_logs WHERE 1=1';
    const params: any[] = [];
    let pIdx = 1;

    if (category && category !== 'ALL') {
      sql += ` AND category = $${pIdx++}`;
      params.push(category);
    }

    if (adminUser && adminUser !== 'ALL') {
      sql += ` AND admin_user ILIKE $${pIdx++}`;
      params.push(`%${adminUser}%`);
    }

    if (status && status !== 'ALL') {
      sql += ` AND status = $${pIdx++}`;
      params.push(status);
    }

    if (query) {
      sql += ` AND (admin_user ILIKE $${pIdx} OR action ILIKE $${pIdx} OR target_resource ILIKE $${pIdx} OR details ILIKE $${pIdx} OR action_needed ILIKE $${pIdx})`;
      params.push(`%${query}%`);
      pIdx++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${pIdx}`;
    params.push(limit);

    const { rows } = await pool.query(sql, params);

    const mapped = rows.map((r: any) => ({
      id: r.id,
      admin_user: r.admin_user,
      admin_role: r.admin_role,
      action: r.action,
      category: r.category,
      target_resource: r.target_resource,
      details: r.details,
      diff: r.diff,
      status: r.status,
      action_needed: r.action_needed,
      fix_status: r.fix_status,
      timestamp: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      ip_address: r.ip_address,
      user_agent: r.user_agent,
    }));

    return NextResponse.json({ success: true, logs: mapped });
  } catch (error: any) {
    console.error('Failed to query audit logs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

/**
 * POST /api/admin/audit - Record an administrative audit action
 */
export async function POST(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getDbPool();
    await ensureAuditTable(pool);

    const body = await req.json();
    const id = body.id || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const admin_user = body.admin_user || auth.username || 'admin_user';
    const admin_role = body.admin_role || auth.role || 'admin';
    const action = body.action || 'ADMIN_ACTION';
    const category = body.category || 'general';
    const target_resource = body.target_resource || 'System';
    const details = body.details || body.action || 'Administrative event logged';
    const diff = body.diff ? JSON.stringify(body.diff) : null;
    const status = body.status || 'info';
    const action_needed = body.action_needed || null;
    const fix_status = action_needed ? (body.fix_status || 'open') : null;

    const forwarded = req.headers.get('x-forwarded-for');
    const ip_address = body.ip_address || (forwarded ? forwarded.split(',')[0].trim() : 'local');
    const user_agent = body.user_agent || req.headers.get('user-agent') || 'Unknown Agent';

    await pool.query(
      `INSERT INTO admin_audit_logs 
        (id, admin_user, admin_role, action, category, target_resource, details, diff, status, action_needed, fix_status, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
       ON CONFLICT (id) DO UPDATE SET
        details = EXCLUDED.details,
        diff = EXCLUDED.diff,
        status = EXCLUDED.status,
        action_needed = EXCLUDED.action_needed,
        fix_status = EXCLUDED.fix_status`,
      [id, admin_user, admin_role, action, category, target_resource, details, diff, status, action_needed, fix_status, ip_address, user_agent]
    );

    return NextResponse.json({
      success: true,
      log: {
        id,
        admin_user,
        admin_role,
        action,
        category,
        target_resource,
        details,
        diff: body.diff || null,
        status,
        action_needed,
        fix_status,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error: any) {
    console.error('Failed to record audit log:', error);
    return NextResponse.json({ success: false, error: 'Failed to record audit log' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/audit - Update fix status on an audit log item
 */
export async function PATCH(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getDbPool();
    await ensureAuditTable(pool);

    const body = await req.json();
    const { id, fix_status } = body;

    if (!id || !fix_status) {
      return NextResponse.json({ success: false, error: 'Missing id or fix_status' }, { status: 400 });
    }

    await pool.query(
      `UPDATE admin_audit_logs SET fix_status = $1 WHERE id = $2`,
      [fix_status, id]
    );

    return NextResponse.json({ success: true, id, fix_status });
  } catch (error: any) {
    console.error('Failed to update audit log fix status:', error);
    return NextResponse.json({ success: false, error: 'Failed to update fix status' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/audit - Purge audit logs (Superadmin only)
 */
export async function DELETE(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Only superadmins can clear audit logs' }, { status: 403 });
  }

  try {
    const pool = getDbPool();
    await ensureAuditTable(pool);
    await pool.query('DELETE FROM admin_audit_logs');
    return NextResponse.json({ success: true, message: 'All audit logs cleared successfully' });
  } catch (error: any) {
    console.error('Failed to clear audit logs:', error);
    return NextResponse.json({ success: false, error: 'Failed to clear audit logs' }, { status: 500 });
  }
}
