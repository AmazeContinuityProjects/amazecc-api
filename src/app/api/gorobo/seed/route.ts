/**
 * @openapi
 * /api/gorobo/seed:
 *   post:
 *     tags:
 *       - GoRobo
 *     summary: Seed or update GoRoBo shop items (idempotent upsert, admin only)
 *     description: >
 *       Upserts the full GoRoBo item catalog into gorobo_items. Items are
 *       keyed by their stable id — existing rows are updated in place, new
 *       ones are inserted. Safe to run any number of times.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     price:
 *                       type: number
 *                     category:
 *                       type: string
 *                     inStock:
 *                       type: boolean
 *                     image:
 *                       type: string
 *     responses:
 *       200:
 *         description: Seed completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

import { NextResponse } from "next/server";
import { getDbPool, getDbErrorStatus, getDbErrorMessage } from "@/lib/db";
import { ensureGoroboSchema } from "@/lib/gorobo/schema";
import { requireAdminAuth } from "@/lib/auth";
import seedItems from "@/data/gorobo/items.json";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  let data = seedItems;

  const body = await req.json().catch(() => null);
  if (body && Array.isArray(body.items) && body.items.length > 0) {
    data = body.items;
  }

  // Replace semantics by default: rows whose ids are not in the payload are
  // pruned so stale ids (e.g. the old slug-based catalog) don't linger.
  const replace = body?.replace !== false;

  try {
    await ensureGoroboSchema();

    const pool = getDbPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const item of data) {
        if (!item.id || !item.name || typeof item.price !== "number") {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { success: false, error: "Each item needs id, name, and a numeric price" },
            { status: 400 }
          );
        }
        await client.query(
          `INSERT INTO gorobo_items (id, name, description, price, base_price, margin, category, in_stock, image)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             description = EXCLUDED.description,
             price = EXCLUDED.price,
             base_price = EXCLUDED.base_price,
             margin = EXCLUDED.margin,
             category = EXCLUDED.category,
             in_stock = EXCLUDED.in_stock,
             image = EXCLUDED.image,
             updated_at = now()`,
          [
            item.id,
            item.name,
            item.description || "",
            item.price,
            item.basePrice ?? Number(item.price) - Number(item.margin ?? 0),
            item.margin ?? 0,
            item.category || "",
            item.inStock !== false,
            item.image || "",
          ]
        );
      }

      if (replace) {
        await client.query(`DELETE FROM gorobo_items WHERE NOT (id = ANY($1))`, [
          data.map((item) => item.id),
        ]);
      }

      await client.query("COMMIT");
    } catch (error: any) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      message: "GoRoBo items seeded successfully",
      stats: { items: data.length, replaced: replace },
    });
  } catch (error: any) {
    console.error("gorobo seed POST error:", error.message);
    return NextResponse.json({ success: false, error: getDbErrorMessage(error) }, { status: getDbErrorStatus(error) });
  }
}
