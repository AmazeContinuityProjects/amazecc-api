import { NextResponse, NextRequest } from 'next/server';
import { getDbPool } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth';




/**
 * @openapi
 * /api/qbank/admin/queue:
 *   get:
 *     tags:
 *       - Qbank
 *     summary: GET endpoint for /api/qbank/admin/queue
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

export const dynamic = 'force-dynamic';

// GET /api/qbank/admin/queue — fetch all pending papers
export async function GET(req: NextRequest) {
  const authResult = await requireAdminAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  try {
    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT * FROM papers_archive WHERE approval_status IN ('PENDING', 'OCR_PROCESSING', 'PENDING_Q_APPROVAL') ORDER BY created_at DESC`
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}