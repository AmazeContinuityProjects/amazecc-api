/**
 * @openapi
 * /api/social/semester:
 *   get:
 *     tags: [Social]
 *     summary: The campus-wide current semester
 *     description: >
 *       No credentials required — a semester code is not private. Exists so the
 *       client can label its semester switch and default a peer read without
 *       guessing. The value is the last one the server resolved from VTOP
 *       during a derivation, so it is always a term VTOP actually confirmed.
 *     responses:
 *       200: { description: Current semester }
 *       404: { description: Nothing cached yet }
 */

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = getDbPool();
    const { rows } = await pool.query(
      "SELECT value, updated_at FROM app_config WHERE key = 'social_current_semester'"
    );
    if (!rows.length) {
      return NextResponse.json(
        { success: false, error: "no_current_semester", detail: "No derivation has run yet" },
        { status: 404 }
      );
    }
    const v = rows[0].value as { semesterId?: string; label?: string; resolvedAt?: string };
    return NextResponse.json({
      success: true,
      semesterId: v?.semesterId ?? "",
      semesterLabel: v?.label ?? "",
      resolvedAt: v?.resolvedAt ?? null,
    });
  } catch (err: unknown) {
    console.error("social/semester error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ success: false, error: "database_unavailable" }, { status: 503 });
  }
}
