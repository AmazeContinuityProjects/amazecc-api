/**
 * @openapi
 * /api/admin/gorobo/orders:
 *   get:
 *     tags:
 *       - GoRoBo Admin
 *     summary: List orders (admin)
 *     description: Lists orders with status filters and search by name/phone. Requires the gorobo permission.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         required: false
 *         description: pending | confirmed | completed
 *         schema:
 *           type: string
 *       - name: search
 *         in: query
 *         required: false
 *         description: Case-insensitive search over user_name or phone_number
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Orders fetched
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { ensureGoroboSchema, GOROBO_ORDER_STATUSES } from "@/lib/gorobo/schema";
import { requireGoroboAdmin } from "@/lib/gorobo/admin-auth";
import { ORDER_SELECT, mapOrderRow, type GoroboOrderRow } from "@/lib/gorobo/orders";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireGoroboAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureGoroboSchema();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status")?.trim() || "";
    const search = searchParams.get("search")?.trim() || "";

    const pool = getDbPool();
    const conditions: string[] = [];
    const params: string[] = [];
    if (status) {
      if (!(GOROBO_ORDER_STATUSES as readonly string[]).includes(status)) {
        return NextResponse.json(
          { success: false, error: `status must be one of: ${GOROBO_ORDER_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(user_name ILIKE $${params.length} OR phone_number ILIKE $${params.length})`);
    }

    let query = ORDER_SELECT;
    if (conditions.length) query += ` WHERE ${conditions.join(" AND ")}`;
    query += ` ORDER BY created_at DESC LIMIT 500`;

    const { rows } = await pool.query<GoroboOrderRow>(query, params);
    const orders = rows.map(mapOrderRow);
    return NextResponse.json({ success: true, count: orders.length, orders });
  } catch (error: any) {
    console.error("admin gorobo orders GET error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
