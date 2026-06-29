/**
 * @openapi
 * /api/payment-receipts:
 *   post:
 *     tags:
 *       - Payment Receipts
 *     summary: Auto-generated POST endpoint for /api/payment-receipts
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               authorizedID:
 *                 type: string
 *               applNo:
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
import { parsePaymentReceipts } from "@/lib/parsers/payment-receipts";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf, applNo } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });
    }
    const client = VTOPClient();
    const params: Record<string, string> = {
      verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
    };
    if (applNo) params.applNo = applNo;
    const resp = await client.post(
      "/vtop/p2p/getReceiptsApplno",
      new URLSearchParams(params).toString(),
      {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
        },
      }
    );
    if (applNo) {
      const data = parsePaymentReceipts(resp.data);
      return NextResponse.json({ success: true, ...data });
    }
    const data = parsePaymentReceipts(resp.data);
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error("payment-receipts error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
