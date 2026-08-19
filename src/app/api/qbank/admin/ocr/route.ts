import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { runPaperOcr } from '@/lib/qbank/ocr';

/**
 * @openapi
 * /api/qbank/admin/ocr:
 *   post:
 *     tags:
 *       - Qbank
 *     summary: POST endpoint for /api/qbank/admin/ocr
 *     description: Runs the real OCR pipeline on a question paper (text-layer extraction or tesseract.js for scanned PDFs), inserts the extracted questions, and moves the paper to PENDING_Q_APPROVAL (or OCR_FAILED with logs).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paperId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authResult = await requireAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { paperId } = await req.json();
    if (!paperId) return NextResponse.json({ error: 'Paper ID is required' }, { status: 400 });

    const result = await runPaperOcr(paperId);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'OCR failed' }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      count: result.count,
      engine: result.engine,
      pages: result.pages,
      elapsedMs: result.elapsedMs,
    });
  } catch (error: unknown) {
    console.error('OCR Pipeline Error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}