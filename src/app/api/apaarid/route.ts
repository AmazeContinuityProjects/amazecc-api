/**
 * @openapi
 * /api/apaarid:
 *   post:
 *     tags:
 *       - Apaarid
 *     summary: Auto-generated POST endpoint for /api/apaarid
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
 *                 parsed: "sample_value"
 *                 success: true
 *                 hasApaar: "sample_value"
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
import { parseVtopHtml } from "@/lib/parsers/auto-parse";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });
    }
    const client = VTOPClient();
    const resp = await client.post(
      "/vtop/apaarid/upload",
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
    const parsed = parseVtopHtml(resp.data);
    const hasApaar = parsed?.keyValuePairs && Object.keys(parsed.keyValuePairs).length > 0
      || parsed?.tables && parsed.tables.some(t => t.rows.length > 0)
      || Object.values(parsed?.formFields || {}).some(v => v && v.length > 4 && v !== '-' && !v.startsWith('0'))
      || /\.pdf/i.test(resp.data)
      || /already uploaded|submitted successfully/i.test(resp.data);
    return NextResponse.json({ success: true, hasApaar, ...parsed });
  } catch (err: unknown) {
    console.error("apaarid error:", (err instanceof Error ? err.message : String(err)));
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
