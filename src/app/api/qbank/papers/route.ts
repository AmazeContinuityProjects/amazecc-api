import { NextResponse, NextRequest } from 'next/server';
import { getDbPool } from '@/lib/db';



/**
 * @openapi
 * /api/qbank/papers:
 *   get:
 *     tags:
 *       - Qbank
 *     summary: GET endpoint for /api/qbank/papers
 *     parameters:
 *       - name: course
 *         in: query
 *         required: false
 *         schema:
 *           type: string
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

// GET /api/qbank/papers?course=CSE1001
export async function GET(req: NextRequest) {
  try {
    const courseCode = req.nextUrl.searchParams.get('course');
    if (!courseCode) {
      return NextResponse.json({ success: false, error: 'course param required' }, { status: 400 });
    }

    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT * FROM papers_archive WHERE course_code = $1 AND approval_status = 'APPROVED' ORDER BY created_at DESC`,
      [courseCode]
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error: unknown) {
    console.error('Papers fetch error:', error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
