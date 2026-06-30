import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { s3 } from '@/lib/clients/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ paperId: string }> }
) {
  try {
    const { paperId } = await params;
    const pool = getDbPool();

    // Verify paper exists in database
    const { rows } = await pool.query(
      `SELECT * FROM papers_archive WHERE source_id = $1`,
      [paperId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }

    const paper = rows[0];
    const key = `papers/${paperId}.pdf`;

    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME!,
      Key: key,
    });
    const data = await s3.send(command);

    if (!data.Body) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

    const webStream = data.Body.transformToWebStream();
    
    // Sanitize filename for headers
    const filename = `${paper.course_code || 'paper'}_${paper.exam_year || 'year'}_${paper.exam_semester || 'sem'}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');

    return new NextResponse(webStream, {
      headers: {
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Type': 'application/pdf',
      },
    });
  } catch (error: any) {
    console.error('Paper download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
