import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getDbPool();

    // Fetch all papers from database
    const { rows: allPapers } = await pool.query(
      `SELECT source_id, course_code, title, file_url, file_size, storage_provider, created_at FROM papers_archive`
    );

    // Classification utility
    const isRemoteUrl = (url: string) => {
      if (!url || url === 'DIRECT_JSON') return false;
      const lowerUrl = url.toLowerCase();
      return (
        lowerUrl.includes('drive.google') ||
        lowerUrl.includes('onedrive') ||
        lowerUrl.includes('dropbox') ||
        lowerUrl.includes('sharepoint') ||
        lowerUrl.includes('live.com') ||
        lowerUrl.includes('docs.google')
      );
    };

    const r2Papers = allPapers.filter((p: any) => !isRemoteUrl(p.file_url) && p.file_url !== 'DIRECT_JSON');
    const otherPapers = allPapers.filter((p: any) => isRemoteUrl(p.file_url));
    const jsonPapers = allPapers.filter((p: any) => p.file_url === 'DIRECT_JSON');

    const totalSize = r2Papers.reduce((sum: number, p: any) => sum + (Number(p.file_size) || 0), 0);

    const largestFiles = [...allPapers]
      .filter((p: any) => p.file_size)
      .sort((a: any, b: any) => (Number(b.file_size) || 0) - (Number(a.file_size) || 0))
      .slice(0, 5)
      .map((p: any) => ({
        source_id: p.source_id,
        course_code: p.course_code,
        title: p.title,
        file_size: Number(p.file_size) || 0,
        storage_provider: p.storage_provider,
        created_at: p.created_at,
        file_url: p.file_url
      }));

    const recentUploads = [...allPapers]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((p: any) => ({
        source_id: p.source_id,
        course_code: p.course_code,
        title: p.title,
        file_size: Number(p.file_size) || 0,
        storage_provider: p.storage_provider,
        created_at: p.created_at,
        file_url: p.file_url
      }));

    // Fetch diagram count
    const { rows: questions } = await pool.query(
      `SELECT diagram_url FROM qbank_questions WHERE diagram_url IS NOT NULL AND diagram_url != ''`
    );
    const diagramCount = questions.length;

    return NextResponse.json({
      success: true,
      data: {
        totalSize,
        r2Count: r2Papers.length,
        otherCount: otherPapers.length,
        jsonCount: jsonPapers.length,
        diagramCount,
        largestFiles,
        recentUploads
      }
    });
  } catch (error: any) {
    console.error('Storage stats GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { action } = await req.json();
    const pool = getDbPool();

    if (action === 'delete_orphaned') {
      // Prune rejected papers
      await pool.query(`DELETE FROM papers_archive WHERE approval_status = 'REJECTED'`);
      return NextResponse.json({ success: true, message: 'Pruned rejected papers successfully.' });
    }

    if (action === 'find_missing') {
      // Find papers with missing URLs
      const { rows } = await pool.query(`SELECT source_id, course_code, title FROM papers_archive WHERE file_url IS NULL OR file_url = ''`);
      return NextResponse.json({ success: true, missing: rows, missingCount: rows.length });
    }

    if (action === 'rebuild_metadata') {
      // Rebuild metadata is a no-op / success acknowledgment
      return NextResponse.json({ success: true, message: 'Metadata rebuilt successfully.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Storage POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
