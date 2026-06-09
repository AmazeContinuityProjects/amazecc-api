import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';



/**
 * @openapi
 * /api/qbank/courses:
 *   get:
 *     tags:
 *       - Qbank
 *     summary: GET endpoint for /api/qbank/courses
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

export async function GET() {
  try {
    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT DISTINCT course_code as code, title FROM papers_archive WHERE approval_status = 'APPROVED'`
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
