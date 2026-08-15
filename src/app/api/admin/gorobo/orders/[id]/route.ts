/**
 * @openapi
 * /api/admin/gorobo/orders/[id]:
 *   get:
 *     tags:
 *       - GoRoBo Admin
 *     summary: Get order detail (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Order detail
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Order not found
 *   put:
 *     tags:
 *       - GoRoBo Admin
 *     summary: Edit the quote for an order (admin)
 *     description: >
 *       Edits line items (quantities, unit prices, custom lines), discount (max 10%),
 *       GST % (default 18), shipment cost and notes. The server recomputes subtotal,
 *       discount, GST and total. Not allowed once the order is completed.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 description: Line items. Inventory lines: {itemId, quantity, unitPrice?}; custom lines: {custom: true, name, quantity, unitPrice}
 *               discountPct:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 10
 *               gstPct:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *               shipmentCost:
 *                 type: number
 *                 minimum: 0
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Quote saved
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Order not found
 *       409:
 *         description: Order already completed
 */

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { ensureGoroboSchema } from "@/lib/gorobo/schema";
import { requireGoroboAdmin } from "@/lib/gorobo/admin-auth";
import { computeQuote } from "@/lib/gorobo/quote";
import { ORDER_SELECT, mapOrderRow, parseQuoteBody, QuoteValidationError, type GoroboOrderRow } from "@/lib/gorobo/orders";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  const auth = await requireGoroboAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    await ensureGoroboSchema();
    const pool = getDbPool();
    const { rows } = await pool.query<GoroboOrderRow>(`${ORDER_SELECT} WHERE id = $1`, [id]);
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const { rows: walletRows } = await pool.query(
      `SELECT party, kind, amount::float8, status, settled_at, created_at
       FROM gorobo_wallet_entries WHERE order_id = $1 ORDER BY kind, party`,
      [id]
    );

    return NextResponse.json({ success: true, order: mapOrderRow(rows[0]), wallet: walletRows });
  } catch (error: any) {
    console.error("admin gorobo order GET error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, context: RouteContext) {
  const auth = await requireGoroboAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await ensureGoroboSchema();
    const pool = getDbPool();

    const { rows: existing } = await pool.query<GoroboOrderRow>(
      `SELECT status FROM gorobo_orders WHERE id = $1`,
      [id]
    );
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }
    if (existing[0].status === "completed") {
      return NextResponse.json(
        { success: false, error: "Cannot edit an order that is already completed" },
        { status: 409 }
      );
    }

    const parsed = await parseQuoteBody(body, pool);
    const quote = computeQuote(parsed);

    const { rows } = await pool.query<GoroboOrderRow>(
      `UPDATE gorobo_orders
       SET items = $1::jsonb,
           subtotal = $2,
           discount_pct = $3,
           discount_amount = $4,
           gst_pct = $5,
           gst_amount = $6,
           shipment_cost = $7,
           notes = $8,
           total = $9
       WHERE id = $10
       RETURNING id, user_name, phone_number, items, total, status, subtotal, discount_pct,
                 discount_amount, gst_pct, gst_amount, shipment_cost, notes, created_at`,
      [
        JSON.stringify(parsed.lines),
        quote.subtotal,
        parsed.discountPct,
        quote.discountAmount,
        parsed.gstPct,
        quote.gstAmount,
        parsed.shipmentCost,
        parsed.notes,
        quote.total,
        id,
      ]
    );

    return NextResponse.json({ success: true, order: mapOrderRow(rows[0]) });
  } catch (error: any) {
    if (error instanceof QuoteValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error("admin gorobo order PUT error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
