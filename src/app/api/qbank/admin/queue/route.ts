/**
 * @openapi
 * /api/qbank/admin/queue:
 *   get:
 *     tags:
 *       - Qbank
 *     summary: Auto-generated GET endpoint for /api/qbank/admin/queue
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
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
 *                 data: "sample_value"
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

import { NextResponse, NextRequest } from 'next/server';
import { getDbPool } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/qbank/admin/queue — fetch ALL papers with optional status filter
export async function GET(req: NextRequest) {
  const authResult = await requireAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const pool = getDbPool();
    const status = req.nextUrl.searchParams.get('status');

    let queryText = `SELECT * FROM papers_archive`;
    const params: any[] = [];

    if (status && status !== 'ALL') {
      queryText += ` WHERE approval_status = $1`;
      params.push(status);
    }

    queryText += ` ORDER BY created_at DESC`;

    const { rows } = await pool.query(queryText, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/qbank/admin/queue — update paper details (title, course_code, etc.)
export async function PATCH(req: NextRequest) {
  const authResult = await requireAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { paperId, ...updates } = body;
    if (!paperId) return NextResponse.json({ success: false, error: 'paperId required' }, { status: 400 });

    const allowedFields: Record<string, string> = {
      title: 'title',
      course_code: 'course_code',
      source_type: 'source_type',
      exam_year: 'exam_year',
      exam_semester: 'exam_semester',
      file_url: 'file_url',
      approval_status: 'approval_status',
      uploader_reg_no: 'uploader_reg_no',
    };

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields[key]) {
        setClauses.push(`${allowedFields[key]} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(paperId);
    const queryText = `UPDATE papers_archive SET ${setClauses.join(', ')} WHERE source_id = $${paramIndex} RETURNING *`;

    const pool = getDbPool();
    const { rows } = await pool.query(queryText, values);

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Paper not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
