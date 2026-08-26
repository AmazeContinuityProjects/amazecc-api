/**
 * @openapi
 * /api/gorobo/version:
 *   get:
 *     tags:
 *       - GoRobo
 *     summary: Catalog freshness probe (row count + last update)
 *     description: >
 *       Cheap single-row aggregate so clients and CI snapshot jobs can detect
 *       catalog drift without downloading items. Short edge TTL.
 *     responses:
 *       200:
 *         description: Version info fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 lastUpdate:
 *                   type: string
 *                   nullable: true
 *       500:
 *         description: Internal Server Error
 */

import { NextResponse } from "next/server";
import { getDbPool, getDbErrorStatus, getDbErrorMessage } from "@/lib/db";
import { ensureGoroboSchema } from "@/lib/gorobo/schema";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET() {
  try {
    await ensureGoroboSchema();
    const pool = getDbPool();
    const { rows } = await pool.query<{ count: string; last_update: string | null }>(
      `SELECT count(*)::text AS count, max(updated_at)::text AS last_update FROM gorobo_items`,
    );
    return NextResponse.json(
      {
        success: true,
        count: parseInt(rows[0]?.count ?? "0", 10),
        lastUpdate: rows[0]?.last_update ?? null,
      },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  } catch (error: any) {
    console.error("gorobo version GET error:", error.message);
    return NextResponse.json(
      { success: false, error: getDbErrorMessage(error) },
      { status: getDbErrorStatus(error), headers: { "Cache-Control": "no-store" } },
    );
  }
}
