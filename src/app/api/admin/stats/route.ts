import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';

export async function GET(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getDbPool();

    const [usersResult, papersResult, busesResult, subsResult] = await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT user_id) AS count FROM push_subscriptions`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE approval_status = 'APPROVED') AS approved,
        COUNT(*) FILTER (WHERE approval_status = 'PENDING') AS pending,
        COUNT(*) FILTER (WHERE approval_status = 'PENDING_Q_APPROVAL') AS pending_review,
        COUNT(*) FILTER (WHERE approval_status LIKE 'OCR%') AS ocr_status,
        COUNT(*) FILTER (WHERE approval_status = 'OCR_FAILED') AS failed_ocr
      FROM papers_archive`).catch(() => ({ rows: [{ total: 0, approved: 0, pending: 0, pending_review: 0, ocr_status: 0, failed_ocr: 0 }] })),
      pool.query(`SELECT COUNT(*) AS count FROM buses`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) AS count FROM push_subscriptions WHERE vitol_enabled = TRUE`).catch(() => ({ rows: [{ count: 0 }] })),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        activeUsers: Number(usersResult.rows[0]?.count || 0),
        papers: {
          total: Number(papersResult.rows[0]?.total || 0),
          approved: Number(papersResult.rows[0]?.approved || 0),
          pending: Number(papersResult.rows[0]?.pending || 0),
          pendingReview: Number(papersResult.rows[0]?.pending_review || 0),
          failedOcr: Number(papersResult.rows[0]?.failed_ocr || 0),
        },
        busRoutes: Number(busesResult.rows[0]?.count || 0),
        vitolSubscribers: Number(subsResult.rows[0]?.count || 0),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}