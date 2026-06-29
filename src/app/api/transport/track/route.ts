/**
 * @openapi
 * /api/transport/track:
 *   post:
 *     tags:
 *       - Transport
 *     summary: Auto-generated POST endpoint for /api/transport/track
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               busRouteId:
 *                 type: string
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
 *                 busUrl: "sample_value"
 *                 success: true
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

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf, busRouteId } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID || !busRouteId) {
      return NextResponse.json({ error: "Missing csrf, authorizedID, or busRouteId" }, { status: 400 });
    }

    const client = VTOPClient();
    const resp = await client.post(
      "/vtop/transport/trackMyBus",
      new URLSearchParams({
        authorizedID: String(authorizedID),
        _csrf: String(csrf),
        busRouteId: String(busRouteId),
        x: Date.now().toString(),
      }).toString(),
      {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const responseData = typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data;

    return NextResponse.json({
      success: true,
      busUrl: responseData.busUrl || "",
    });
  } catch (error: any) {
    console.error("Track bus error:", error);
    return NextResponse.json({ error: error.message || "Failed to track bus" }, { status: 500 });
  }
}
