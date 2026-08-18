import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/lib/auth';
import { UploadFileToS3 } from '@/lib/clients/s3';

/**
 * @openapi
 * /api/qbank/admin/upload-diagram:
 *   post:
 *     tags:
 *       - Qbank
 *     summary: Upload a question diagram image to R2 storage
 *     description: Accepts a multipart file upload, stores it under qbank-diagrams/ in R2, and returns a public URL served by /api/qbank/diagrams/[name].
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
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

const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

export async function POST(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const rawForm = (await req.formData()) as unknown as { get(name: string): unknown };
    const file = rawForm.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const ext = ALLOWED_MIME[file.type];
    if (!ext) {
      return NextResponse.json(
        { success: false, error: `Unsupported file type: ${file.type || 'unknown'}. Use PNG, JPEG, WebP, GIF or SVG.` },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File too large (max 10 MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = `${randomUUID()}.${ext}`;
    await UploadFileToS3(buffer, `qbank-diagrams/${name}`, file.type);

    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('host') || 'api.amazecc.com';
    const url = `${proto}://${host}/api/qbank/diagrams/${name}`;

    return NextResponse.json({ success: true, url, name });
  } catch (error: unknown) {
    console.error('Diagram upload error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}