import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.permissions.includes('transport') && !auth.permissions.includes('buses')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const pool = getDbPool();
    const { id: ruleId } = await params;
    const id = parseInt(ruleId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid rule ID' }, { status: 400 });
    }

    const { rowCount } = await pool.query('DELETE FROM transport_rules WHERE id = $1', [id]);
    if (rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Rule deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete rule:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
