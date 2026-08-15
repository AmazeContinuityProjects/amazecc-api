/**
 * @openapi
 * /api/admin/gorobo/items/[id]:
 *   put:
 *     tags:
 *       - GoRoBo Admin
 *     summary: Update an inventory item (admin)
 *     description: Partial update allowed. price is recomputed as basePrice + margin.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               basePrice:
 *                 type: number
 *               margin:
 *                 type: number
 *               inStock:
 *                 type: boolean
 *               image:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Item not found
 */

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { ensureGoroboSchema, type GoroboItem } from "@/lib/gorobo/schema";
import { requireGoroboAdmin } from "@/lib/gorobo/admin-auth";
import { mapItemRow, computePrice } from "@/lib/gorobo/items";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
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

    const { rows: existing } = await pool.query<GoroboItem>(
      `SELECT id, name, description, price, base_price, margin, category, in_stock, image, updated_at
       FROM gorobo_items WHERE id = $1`,
      [id]
    );
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
    }

    const current = existing[0];
    const name = body.name !== undefined ? (typeof body.name === "string" ? body.name.trim() : null) : current.name;
    const category = body.category !== undefined ? (typeof body.category === "string" ? body.category.trim() : null) : current.category;
    const basePrice = body.basePrice !== undefined ? Number(body.basePrice) : Number(current.base_price);
    const margin = body.margin !== undefined ? Number(body.margin) : Number(current.margin);
    const description = body.description !== undefined ? (typeof body.description === "string" ? body.description.trim() : current.description) : current.description;
    const image = body.image !== undefined ? (typeof body.image === "string" ? body.image.trim() : current.image) : current.image;
    const inStock = body.inStock !== undefined ? body.inStock !== false : current.in_stock;

    if (!name || name.length > 100) {
      return NextResponse.json({ success: false, error: "name must be 1-100 characters" }, { status: 400 });
    }
    if (!category || category.length > 60) {
      return NextResponse.json({ success: false, error: "category must be 1-60 characters" }, { status: 400 });
    }
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      return NextResponse.json({ success: false, error: "basePrice must be a number >= 0" }, { status: 400 });
    }
    if (!Number.isFinite(margin) || margin < 0) {
      return NextResponse.json({ success: false, error: "margin must be a number >= 0" }, { status: 400 });
    }

    const base = Math.round(basePrice * 100) / 100;
    const marg = Math.round(margin * 100) / 100;
    const price = computePrice(base, marg);

    const { rows } = await pool.query<GoroboItem>(
      `UPDATE gorobo_items
       SET name = $1, description = $2, price = $3, base_price = $4, margin = $5,
           category = $6, in_stock = $7, image = $8, updated_at = now()
       WHERE id = $9
       RETURNING id, name, description, price, base_price, margin, category, in_stock, image, updated_at`,
      [name, description, price, base, marg, category, inStock, image, id]
    );

    return NextResponse.json({ success: true, item: mapItemRow(rows[0]) });
  } catch (error: any) {
    console.error("admin gorobo items PUT error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
