import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth';
import { s3 } from '@/lib/clients/s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';

export const dynamic = 'force-dynamic';

function getDirectDownloadUrl(url: string): string {
  if (url.includes('drive.google.com')) {
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://docs.google.com/uc?export=download&id=${fileIdMatch[1]}`;
    }
  }
  return url;
}

export async function POST(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { paperId } = body;
    if (!paperId) {
      return NextResponse.json({ success: false, error: 'paperId required' }, { status: 400 });
    }

    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT * FROM papers_archive WHERE source_id = $1`,
      [paperId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Paper not found' }, { status: 404 });
    }

    const paper = rows[0];
    const remoteUrl = paper.file_url;

    if (!remoteUrl || remoteUrl === 'DIRECT_JSON') {
      return NextResponse.json({ success: false, error: 'Paper does not have a downloadable file URL' }, { status: 400 });
    }

    const downloadUrl = getDirectDownloadUrl(remoteUrl);
    let response;
    try {
      response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 30000 // 30 seconds
      });
    } catch (downloadError: unknown) {
      console.error(`Failed to download file from ${downloadUrl}:`, downloadError);
      return NextResponse.json({ 
        success: false, 
        error: `Failed to download file from remote host: ${(downloadError instanceof Error ? downloadError.message : String(downloadError))}` 
      }, { status: 502 });
    }

    const buffer = Buffer.from(response.data);
    const contentType = String(response.headers['content-type'] || 'application/pdf');

    // Upload to Cloudflare R2
    const key = `papers/${paperId}.pdf`;
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.B2_BUCKET_NAME!,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );
    } catch (uploadError: unknown) {
      console.error('R2 storage upload error:', uploadError);
      return NextResponse.json({ success: false, error: `Storage upload failed: ${(uploadError instanceof Error ? uploadError.message : String(uploadError))}` }, { status: 500 });
    }

    // Construct the public download URL pointing back to our API
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('host') || 'api.amazecc.com';
    const publicUrl = `${proto}://${host}/api/qbank/papers/download/${paperId}`;

    await pool.query(
      `UPDATE papers_archive 
       SET file_url = $1, file_size = $2, storage_provider = 'R2', source_type = 'UPLOAD' 
       WHERE source_id = $3`,
      [publicUrl, buffer.length, paperId]
    );

    return NextResponse.json({ 
      success: true, 
      fileUrl: publicUrl, 
      fileSize: buffer.length 
    });
  } catch (error: unknown) {
    console.error('Import to storage error:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
