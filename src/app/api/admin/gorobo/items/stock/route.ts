import { NextResponse } from "next/server";
import { getDbPool, getDbErrorStatus, getDbErrorMessage } from "@/lib/db";
import { ensureGoroboSchema, type GoroboItem } from "@/lib/gorobo/schema";
import { requireGoroboAdmin } from "@/lib/gorobo/admin-auth";
import { mapItemRow } from "@/lib/gorobo/items";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/gorobo/items/stock
 * Adjusts or sets stock quantity for an item quickly.
 * Body: { itemId: string, delta?: number, stockQuantity?: number }
 */
export async function PATCH(req: Request) {
  const auth = await requireGoroboAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { itemId, delta, stockQuantity } = body;
  if (!itemId) {
    return NextResponse.json({ success: false, error: "itemId is required" }, { status: 400 });
  }

  try {
    await ensureGoroboSchema();
    const pool = getDbPool();

    let query: string;
    let params: any[];

    if (stockQuantity !== undefined) {
      const newQty = Math.max(0, parseInt(stockQuantity, 10) || 0);
      query = `UPDATE gorobo_items
               SET stock_quantity = $1,
                   in_stock = ($1 > 0),
                   updated_at = now()
               WHERE id = $2
               RETURNING id, name, description, price, base_price, margin, category, in_stock, image,
                         sku, stock_quantity, low_stock_threshold, location_bin, datasheet_url, tags, updated_at`;
      params = [newQty, itemId];
    } else if (delta !== undefined) {
      const d = parseInt(delta, 10) || 0;
      query = `UPDATE gorobo_items
               SET stock_quantity = GREATEST(0, stock_quantity + $1),
                   in_stock = (GREATEST(0, stock_quantity + $1) > 0),
                   updated_at = now()
               WHERE id = $2
               RETURNING id, name, description, price, base_price, margin, category, in_stock, image,
                         sku, stock_quantity, low_stock_threshold, location_bin, datasheet_url, tags, updated_at`;
      params = [d, itemId];
    } else {
      return NextResponse.json({ success: false, error: "Must specify delta or stockQuantity" }, { status: 400 });
    }

    const { rows } = await pool.query<GoroboItem>(query, params);
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: mapItemRow(rows[0]) });
  } catch (error: any) {
    console.error("admin gorobo items stock PATCH error:", error.message);
    return NextResponse.json({ success: false, error: getDbErrorMessage(error) }, { status: getDbErrorStatus(error) });
  }
}
