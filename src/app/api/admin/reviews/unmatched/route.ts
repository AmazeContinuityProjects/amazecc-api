import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "open";

  try {
    const pool = getDbPool();
    const { rows } = await pool.query(
      "SELECT * FROM unmatched_faculty WHERE status = $1 ORDER BY seen_count DESC, created_at DESC LIMIT 100",
      [status]
    );

    return NextResponse.json({ success: true, unmatched: rows });
  } catch (err) {
    console.error("[admin/reviews/unmatched GET] Error:", err);
    return NextResponse.json({ error: "Failed to list unmatched faculty" }, { status: 500 });
  }
}
