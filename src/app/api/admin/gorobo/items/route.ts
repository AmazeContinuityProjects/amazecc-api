/**
 * @openapi
 * /api/admin/gorobo/items:
 *   get:
 *     tags:
 *       - GoRoBo Admin
 *     summary: List inventory items (admin)
 *     description: Lists GoRoBo inventory with base price and margin. Requires the gorobo permission.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: search
 *         in: query
 *         required: false
 *         description: Case-insensitive search over id/name/description
 *         schema:
 *           type: string
 *       - name: category
 *         in: query
 *         required: false
 *         description: Filter by exact category
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Items fetched
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *   post:
 *     tags:
 *       - GoRoBo Admin
 *     summary: Add an inventory item (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category, basePrice, margin]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               basePrice:
 *                 type: number
 *                 description: Raw cost to Amaze
 *               margin:
 *                 type: number
 *                 description: Flat profit in rupees; price = basePrice + margin
 *               inStock:
 *                 type: boolean
 *               image:
 *                 type: string
 *     responses:
 *       201:
 *         description: Item created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Item id already exists
 */

import { NextResponse } from "next/server";
import { getDbPool, getDbErrorStatus, getDbErrorMessage } from "@/lib/db";
import { ensureGoroboSchema, type GoroboItem } from "@/lib/gorobo/schema";
import { requireGoroboAdmin } from "@/lib/gorobo/admin-auth";
import { mapItemRow, computePrice } from "@/lib/gorobo/items";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireGoroboAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureGoroboSchema();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";

    const pool = getDbPool();
    let query = `SELECT id, name, description, price, base_price, margin, category, in_stock, image, updated_at
                 FROM gorobo_items`;
    const conditions: string[] = [];
    const params: string[] = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(id ILIKE $${params.length} OR name ILIKE $${params.length} OR description ILIKE $${params.length})`);
    }
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (conditions.length) query += ` WHERE ${conditions.join(" AND ")}`;
    query += ` ORDER BY category ASC, name ASC`;

    const { rows } = await pool.query<GoroboItem>(query, params);
    const items = rows.map(mapItemRow);
    return NextResponse.json({ success: true, count: items.length, items });
  } catch (error: any) {
    console.error("admin gorobo items GET error:", error.message);
    return NextResponse.json({ success: false, error: getDbErrorMessage(error) }, { status: getDbErrorStatus(error) });
  }
}

export async function POST(req: Request) {
  const auth = await requireGoroboAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const basePrice = Number(body?.basePrice);
  const margin = Number(body?.margin);

  if (!name || name.length > 100) {
    return NextResponse.json(
      { success: false, error: "name is required and must be at most 100 characters" },
      { status: 400 }
    );
  }
  if (!category || category.length > 60) {
    return NextResponse.json(
      { success: false, error: "category is required and must be at most 60 characters" },
      { status: 400 }
    );
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
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const image = typeof body?.image === "string" ? body.image.trim() : "";
  const inStock = body?.inStock !== false;

  try {
    await ensureGoroboSchema();
    const pool = getDbPool();

    const { rows: maxRow } = await pool.query<{ next: number }>(
      `SELECT COALESCE(MAX(id::int), 0) + 1 AS next FROM gorobo_items WHERE id ~ '^[0-9]+$'`
    );
    const id = String(maxRow[0].next);

    const { rows } = await pool.query<GoroboItem>(
      `INSERT INTO gorobo_items (id, name, description, price, base_price, margin, category, in_stock, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, description, price, base_price, margin, category, in_stock, image, updated_at`,
      [id, name, description, price, base, marg, category, inStock, image]
    );

    return NextResponse.json({ success: true, item: mapItemRow(rows[0]) }, { status: 201 });
  } catch (error: any) {
    console.error("admin gorobo items POST error:", error.message);
    return NextResponse.json({ success: false, error: getDbErrorMessage(error) }, { status: getDbErrorStatus(error) });
  }
}
