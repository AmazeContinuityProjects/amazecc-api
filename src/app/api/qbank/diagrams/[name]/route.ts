import { NextResponse, NextRequest } from 'next/server';
import { s3 } from '@/lib/clients/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';

/**
 * @openapi
 * /api/qbank/diagrams/{name}:
 *   get:
 *     tags:
 *       - Qbank
 *     summary: Serve a stored question diagram from R2
 *     parameters:
 *       - name: name
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Image bytes
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not Found
 */

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await ctx.params;
    if (!name || name.includes('..') || name.includes('/')) {
      return NextResponse.json({ error: 'Invalid diagram name' }, { status: 400 });
    }

    const result = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME!,
        Key: `qbank-diagrams/${name}`,
      })
    );

    if (!result.Body) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

    const chunks: Uint8Array[] = [];
    const body = result.Body as unknown as AsyncIterable<Uint8Array>;
    for await (const chunk of body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));

    const ext = name.split('.').pop()?.toLowerCase();
    const contentType = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      svg: 'image/svg+xml',
    }[ext || ''] || 'application/octet-stream';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: unknown) {
    const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }
    console.error('Diagram fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}