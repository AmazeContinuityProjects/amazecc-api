/**
 * @openapi
 * /api/payments:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Auto-generated POST endpoint for /api/payments
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
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
 *                 data: "sample_value"
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import { parsePayments } from "@/lib/parsers/payments";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });
    }
    const client = VTOPClient();
    const resp = await client.post(
      "/vtop/p2p/Payments",
      new URLSearchParams({
        verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
      }).toString(),
      {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
        },
      }
    );
    const data = parsePayments(resp.data);
    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    console.error("payments error:", (err instanceof Error ? err.message : String(err)));
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
