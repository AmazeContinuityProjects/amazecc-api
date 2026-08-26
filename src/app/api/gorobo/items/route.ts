/**
 * @openapi
 * /api/gorobo/items:
 *   get:
 *     tags:
 *       - GoRobo
 *     summary: List GoRoBo shop items (paginated, filterable, CDN-cacheable)
 *     description: >
 *       Returns shop items from the gorobo_items table. Supports scoped
 *       pagination (robu-style) via page/limit, category filtering and a
 *       name search. Omitting all params returns the full catalog (used by
 *       CI snapshot jobs). Responses carry Cache-Control headers so
 *       Cloudflare/the CDN can serve them from edge cache; the database is
 *       only hit on cache misses.
 *     parameters:
 *       - name: page
 *         in: query
 *         required: false
 *         description: 1-based page number (requires limit)
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Items per page (1-100). Omit for full list.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - name: category
 *         in: query
 *         required: false
 *         description: Exact category name to filter by
 *         schema:
 *           type: string
 *       - name: q
 *         in: query
 *         required: false
 *         description: Case-insensitive substring search on item name
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
 *                   description: Items returned in this response
 *                 total:
 *                   type: integer
 *                   description: Total matching items across all pages
 *                 page:
 *                   type: integer
 *                 pages:
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
 *                       basePrice:
 *                         type: number
 *                       margin:
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
import { getDbPool, getDbErrorStatus, getDbErrorMessage } from "@/lib/db";
import { ensureGoroboSchema, type GoroboItem } from "@/lib/gorobo/schema";

// Cacheable at the edge (Cloudflare sits in front of Render). Catalog data is
// refreshed by ingest scripts; an hour of edge TTL keeps Supabase load ~0.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

const MAX_LIMIT = 100;

function mapItem(r: GoroboItem) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    price: Number(r.price),
    basePrice: Number(r.base_price ?? 0),
    margin: Number(r.margin ?? 0),
    category: r.category,
    inStock: r.in_stock,
    image: r.image,
  };
}

export async function GET(req: Request) {
  try {
    await ensureGoroboSchema();

    const { searchParams } = new URL(req.url);
    const rawLimit = Number(searchParams.get("limit"));
    const hasPaging = Number.isFinite(rawLimit) && rawLimit > 0;
    const limit = hasPaging ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : 0;
    const page = Math.max(1, Math.floor(Number(searchParams.get("page")) || 1));
    const offset = hasPaging ? (page - 1) * limit : 0;

    const category = searchParams.get("category")?.trim() || "";
    const q = searchParams.get("q")?.trim() || "";

    const where: string[] = [];
    const values: unknown[] = [];
    if (category) {
      values.push(category);
      where.push(`category = $${values.length}`);
    }
    if (q) {
      values.push(`%${q}%`);
      where.push(`name ILIKE $${values.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const pool = getDbPool();
    const countRes = await pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM gorobo_items ${whereSql}`,
      values,
    );
    const total = parseInt(countRes.rows[0]?.total ?? "0", 10);

    let rows: GoroboItem[];
    if (hasPaging) {
      ({ rows } = await pool.query<GoroboItem>(
        `SELECT id, name, description, price::float8, base_price::float8, margin::float8,
                category, in_stock, image
         FROM gorobo_items
         ${whereSql}
         ORDER BY category ASC, name ASC
         LIMIT ${limit} OFFSET ${offset}`,
        values,
      ));
    } else {
      ({ rows } = await pool.query<GoroboItem>(
        `SELECT id, name, description, price::float8, base_price::float8, margin::float8,
                category, in_stock, image
         FROM gorobo_items
         ${whereSql}
         ORDER BY category ASC, name ASC`,
        values,
      ));
    }

    const items = rows.map(mapItem);
    return NextResponse.json(
      {
        success: true,
        count: items.length,
        total,
        page: hasPaging ? page : 1,
        pages: hasPaging ? Math.max(1, Math.ceil(total / limit)) : 1,
        items,
      },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  } catch (error: any) {
    console.error("gorobo items GET error:", error.message);
    return NextResponse.json(
      { success: false, error: getDbErrorMessage(error) },
      { status: getDbErrorStatus(error), headers: { "Cache-Control": "no-store" } },
    );
  }
}
