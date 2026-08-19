import { NextResponse, NextRequest } from 'next/server';
import { getDbPool } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth';




/**
 * @openapi
 * /api/qbank/admin/questions:
 *   get:
 *     tags:
 *       - Qbank
 *     summary: GET endpoint for /api/qbank/admin/questions
 *     parameters:
 *       - name: paperId
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
 *   post:
 *     tags:
 *       - Qbank
 *     summary: POST endpoint for /api/qbank/admin/questions
 *     parameters:
 *       - name: paperId
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paperId:
 *                 type: string
 *               questionId:
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
 *   delete:
 *     tags:
 *       - Qbank
 *     summary: DELETE endpoint for /api/qbank/admin/questions
 *     parameters:
 *       - name: paperId
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

// GET /api/qbank/admin/questions?paperId=xxx
export async function GET(req: NextRequest) {
  const authResult = await requireAdminAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  try {
    const paperId = req.nextUrl.searchParams.get('paperId');
    if (!paperId) return NextResponse.json({ success: false, error: 'paperId required' }, { status: 400 });

    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT * FROM qbank_questions WHERE source_id = $1 ORDER BY question_number ASC`,
      [paperId]
    );
    return NextResponse.json({ success: true, data: rows });
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/qbank/admin/questions — add a new question
export async function POST(req: NextRequest) {
  const authResult = await requireAdminAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  try {
    const { paperId } = await req.json();
    if (!paperId) return NextResponse.json({ success: false, error: 'paperId required' }, { status: 400 });

    const pool = getDbPool();
    const { rows } = await pool.query(
      `INSERT INTO qbank_questions (source_id, question_number, question_text, marks, question_type) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [paperId, 'New', 'Enter question text here...', 0, 'DESCRIPTIVE']
    );
    return NextResponse.json({ success: true, data: rows[0] });
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/qbank/admin/questions — update a question
export async function PATCH(req: NextRequest) {
  const authResult = await requireAdminAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  try {
    const body = await req.json();
    const { questionId } = body;
    if (!questionId) return NextResponse.json({ success: false, error: 'questionId required' }, { status: 400 });

    const updates: string[] = [];
    const values: Array<string | number | boolean | null> = [];
    let paramIndex = 1;

    const addUpdate = (field: string, value: string | number | boolean | null) => {
      updates.push(`${field} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    };

    if ('questionText' in body) addUpdate('question_text', body.questionText);
    if ('questionNumber' in body) addUpdate('question_number', body.questionNumber);
    if ('marks' in body) addUpdate('marks', body.marks);
    if ('questionType' in body) addUpdate('question_type', body.questionType);
    if ('options' in body) addUpdate('options', body.options ? JSON.stringify(body.options) : null);
    if ('correctAnswer' in body) addUpdate('correct_answer', body.correctAnswer);
    if ('imageUrl' in body) addUpdate('image_url', body.imageUrl);
    if ('imageUrls' in body) {
      const urls: string[] = Array.isArray(body.imageUrls) ? body.imageUrls.filter((u: unknown): u is string => typeof u === 'string' && u.length > 0) : [];
      addUpdate('image_urls', JSON.stringify(urls));
      addUpdate('image_url', urls[0] || null);
    }
    if ('hasDiagram' in body) addUpdate('has_diagram', body.hasDiagram === true);
    if ('pageNumber' in body) addUpdate('page_number', body.pageNumber);
    if ('sourcePdfPage' in body) addUpdate('source_pdf_page', body.sourcePdfPage);
    if ('topicName' in body) addUpdate('topic_name', body.topicName);
    if ('metadata' in body) addUpdate('metadata', body.metadata ? JSON.stringify(body.metadata) : null);

    if (updates.length === 0) return NextResponse.json({ success: true });

    values.push(questionId);
    const query = `UPDATE qbank_questions SET ${updates.join(', ')} WHERE question_id = $${paramIndex}`;

    const pool = getDbPool();
    await pool.query(query, values);
    
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/qbank/admin/questions — delete a question
export async function DELETE(req: NextRequest) {
  const authResult = await requireAdminAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  try {
    const { questionId } = await req.json();
    if (!questionId) return NextResponse.json({ success: false, error: 'questionId required' }, { status: 400 });

    const pool = getDbPool();
    await pool.query(`DELETE FROM qbank_questions WHERE question_id = $1`, [questionId]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}