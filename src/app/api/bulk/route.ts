/**
 * @openapi
 * /api/bulk:
 *   post:
 *     tags:
 *       - Bulk
 *     summary: Run several VTOP proxy endpoints in one invocation.
 *     description: >
 *       The sync sweep used to fire a separate request (and function invocation)
 *       for each of these modules. This endpoint takes the list of supported
 *       proxy names, runs them concurrently against the caller's VTOP session,
 *       and returns each result under `results`. A single failing endpoint is
 *       reported in its own result object and never fails the batch.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               endpoints:
 *                 type: array
 *                 items:
 *                   type: string
 *               authorizedID:
 *                 type: string
 *               cookies:
 *                 type: string
 *               csrf:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 success: true
 *                 results:
 *                   bank-info:
 *                     success: true
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 */

import { NextResponse } from "next/server";
import { runVtopProxy, VTOP_PROXY_NAMES } from "@/lib/vtop-proxy";

export async function POST(req: Request) {
  try {
    const { endpoints, cookies, authorizedID, csrf } = await req.json().catch(() => ({}));
    const requested = Array.isArray(endpoints) ? endpoints : [];
    // Whitelist: unknown names are dropped, never executed.
    const wanted = requested.filter(
      (e): e is string => typeof e === "string" && (VTOP_PROXY_NAMES as readonly string[]).includes(e)
    );

    if (wanted.length === 0) {
      return NextResponse.json({ success: false, error: "No supported endpoints requested" }, { status: 400 });
    }

    const results: Record<string, unknown> = {};
    await Promise.allSettled(
      wanted.map(async (name) => {
        const outcome = await runVtopProxy(name, { cookies, authorizedID, csrf });
        results[name] = outcome.body;
      })
    );

    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    console.error("bulk error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to run bulk request" },
      { status: 500 }
    );
  }
}
