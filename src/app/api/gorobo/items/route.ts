/**
 * @openapi
 * /api/gorobo/items:
 *   get:
 *     tags:
 *       - GoRobo
 *     summary: List all GoRoBo shop items
 *     parameters:
 *       - name: category
 *         in: query
 *         required: false
 *         description: Filter items by category name
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Items fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       price:
 *                         type: number
 *                       category:
 *                         type: string
 *                       inStock:
 *                         type: boolean
 *                       image:
 *                         type: string
 *       500:
 *         description: Internal Server Error
 */

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { ensureGoroboSchema, type GoroboItem } from "@/lib/gorobo/schema";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureGoroboSchema();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const pool = getDbPool();
    const { rows } = category
      ? await pool.query<GoroboItem>(
          `SELECT id, name, description, price::float8, category, in_stock, image
           FROM gorobo_items
           WHERE category = $1
           ORDER BY name ASC`,
          [category]
        )
      : await pool.query<GoroboItem>(
          `SELECT id, name, description, price::float8, category, in_stock, image
           FROM gorobo_items
           ORDER BY category ASC, name ASC`
        );

    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      price: Number(r.price),
      category: r.category,
      inStock: r.in_stock,
      image: r.image,
    }));

    return NextResponse.json({ success: true, count: items.length, items });
  } catch (error: any) {
    console.error("gorobo items GET error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
