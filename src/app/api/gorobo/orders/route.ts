/**
 * @openapi
 * /api/gorobo/orders:
 *   post:
 *     tags:
 *       - GoRobo
 *     summary: Place a GoRoBo order (append-only; no delete/update on this route)
 *     description: >
 *       Stores an inquiry order with the customer name, phone number, and the
 *       item ids + quantities requested. Orders are write-only here — they can
 *       only be added, never removed or modified through this route.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone, items]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Customer name
 *                 minLength: 1
 *                 maxLength: 100
 *               phone:
 *                 type: string
 *                 description: Indian mobile number (10 digits, optional +91 prefix)
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [itemId, quantity]
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                       maximum: 99
 *     responses:
 *       201:
 *         description: Order placed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 order:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     user_name:
 *                       type: string
 *                     phone_number:
 *                       type: string
 *                     items:
 *                       type: array
 *                     total:
 *                       type: number
 *                     created_at:
 *                       type: string
 *       400:
 *         description: Invalid request body or unknown item ids
 *       429:
 *         description: Rate limited
 *       500:
 *         description: Internal Server Error
 */

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { ensureGoroboSchema, type GoroboItem, type GoroboOrderLine, type GoroboOrderItem } from "@/lib/gorobo/schema";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const PHONE_RE = /^[6-9]\d{9}$/;

function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  return PHONE_RE.test(digits) ? digits : null;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`gorobo-order:${ip}`, 5, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const bodyObj = body as Record<string, unknown>;
  const name = typeof bodyObj.name === "string" ? (bodyObj.name as string).trim() : "";
  const phone = normalizePhone(bodyObj.phone);

  if (!name || name.length > 100) {
    return NextResponse.json(
      { success: false, error: "name is required and must be at most 100 characters" },
      { status: 400 }
    );
  }
  if (!phone) {
    return NextResponse.json(
      { success: false, error: "phone must be a valid 10-digit Indian mobile number" },
      { status: 400 }
    );
  }

  const rawItems = Array.isArray(bodyObj.items) ? bodyObj.items as unknown[] : null;
  if (!rawItems || rawItems.length === 0 || rawItems.length > 100) {
    return NextResponse.json(
      { success: false, error: "items must be a non-empty array of up to 100 entries" },
      { status: 400 }
    );
  }

  const merged = new Map<string, number>();
  for (const entry of rawItems as Array<Record<string, unknown>>) {
    if (!entry || typeof (entry as Record<string, unknown>).itemId !== "string" || !(entry as Record<string, unknown>).itemId || ((entry as Record<string, unknown>).itemId as string).length > 64) {
      return NextResponse.json(
        { success: false, error: "each item must have a valid itemId" },
        { status: 400 }
      );
    }
    const quantity = Number((entry as Record<string, unknown>).quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return NextResponse.json(
        { success: false, error: `quantity for ${(entry as Record<string, unknown>).itemId} must be an integer between 1 and 99` },
        { status: 400 }
      );
    }
    merged.set((entry as Record<string, unknown>).itemId as string, Math.min((merged.get((entry as Record<string, unknown>).itemId as string) ?? 0) + quantity, 99));
  }

  const orderItems: GoroboOrderItem[] = [...merged.entries()].map(([itemId, quantity]) => ({
    itemId,
    quantity,
  }));

  const deliveryMode =
    bodyObj.deliveryMode === "buzz" || bodyObj.deliveryMode === "bolt" ? "buzz" : "normal";
  const mapsUrl = typeof bodyObj.mapsUrl === "string" ? (bodyObj.mapsUrl as string).trim() : "";

  try {
    await ensureGoroboSchema();

    const pool = getDbPool();
    const { rows: itemRows } = await pool.query<GoroboItem>(
      `SELECT id, name, price, base_price, margin FROM gorobo_items WHERE in_stock = TRUE AND id = ANY($1)`,
      [orderItems.map((i) => i.itemId)]
    );

    const byId = new Map(itemRows.map((r) => [r.id, r]));
    const unknown = orderItems.filter((i) => !byId.has(i.itemId));
    if (unknown.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown or unavailable item ids: ${unknown.map((u) => u.itemId).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const total = orderItems.reduce(
      (sum, i) => sum + Number(byId.get(i.itemId)!.price) * i.quantity,
      0
    );

    // Snapshot unit price / base price / margin per line so the bill processor
    // works even if the catalog changes later.
    const orderLines: GoroboOrderLine[] = orderItems.map((i) => {
      const item = byId.get(i.itemId)!;
      return {
        itemId: i.itemId,
        quantity: i.quantity,
        unitPrice: Number(item.price),
        basePrice: Number(item.base_price),
        margin: Number(item.margin),
      };
    });

    const { rows: orderRows } = await pool.query<{
      id: string;
      user_name: string;
      phone_number: string;
      items: GoroboOrderLine[];
      total: number;
      delivery_mode: string;
      maps_url: string;
      created_at: string;
    }>(
      `INSERT INTO gorobo_orders (user_name, phone_number, items, total, delivery_mode, maps_url)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)
       RETURNING id, user_name, phone_number, items, total, delivery_mode, maps_url, created_at`,
      [name, phone, JSON.stringify(orderLines), total, deliveryMode, mapsUrl]
    );

    const order = orderRows[0];
    return NextResponse.json(
      {
        success: true,
        order: {
          id: order.id,
          user_name: order.user_name,
          phone_number: order.phone_number,
          items: order.items,
          total: Number(order.total),
          delivery_mode: order.delivery_mode,
          maps_url: order.maps_url,
          created_at: order.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("gorobo orders POST error:", (error instanceof Error ? error.message : String(error)));
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
