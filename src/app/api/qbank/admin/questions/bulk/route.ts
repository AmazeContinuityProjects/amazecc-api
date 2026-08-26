import { NextResponse, NextRequest } from 'next/server';
import { getDbPool } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth';



/**
 * @openapi
 * /api/qbank/admin/questions/bulk:
 *   post:
 *     tags:
 *       - Qbank
 *     summary: POST endpoint for /api/qbank/admin/questions/bulk
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paperId:
 *                 type: string
 *               questions:
 *                 type: string
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

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { paperId, questions } = await req.json();

    if (!paperId || !Array.isArray(questions)) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const pool = getDbPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Delete existing questions for this paper
      await client.query('DELETE FROM qbank_questions WHERE source_id = $1', [paperId]);

      // Insert new questions
      for (const q of questions) {
        await client.query(
          `INSERT INTO qbank_questions (source_id, question_number, question_type, topic_name, marks, question_text, options, correct_answer, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            paperId,
            q.question_number?.toString() || '1',
            q.question_type || (q.options && Object.keys(q.options).length > 0 ? 'MCQ' : 'DESCRIPTIVE'),
            q.topic_name || null,
            parseInt(q.marks) || 0,
            q.question_text || '',
            q.options ? JSON.stringify(q.options) : null,
            q.correct_answer || null,
            q.image_url || null
          ]
        );
      }

      await client.query('COMMIT');
      return NextResponse.json({ success: true, count: questions.length });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

  } catch (error: unknown) {
    console.error('Bulk questions import error:', error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
