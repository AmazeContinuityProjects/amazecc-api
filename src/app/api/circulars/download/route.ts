/**
 * @openapi
 * /api/circulars/download:
 *   post:
 *     tags:
 *       - Circulars
 *     summary: Auto-generated POST endpoint for /api/circulars/download
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               authorizedID:
 *                 type: string
 *               circularId:
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

 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

import { NextResponse } from "next/server";
import { vitFetch } from "@/lib/vitFetch";
import { publicErrorMessage } from "@/lib/publicError";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf, circularId } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID || !circularId || !cookieHeader)
      return NextResponse.json({ error: "Missing csrf, authorizedID, circularId or cookies" }, { status: 400 });

    // TLS verified against VIT's incomplete chain (Sectigo DV R36 pinned in vitFetch).
    const timestamp = new Date().toUTCString();
    const params = new URLSearchParams({ _csrf: csrf, authorizedID, val: circularId, x: timestamp });
    const url = `https://vtopcc.vit.ac.in/vtop/admissions/viewStatusWiseCostCentreCircularContent?${params}`;

    const downloadRes = await vitFetch(url, {
      method: "GET",
      headers: {
        Cookie: cookieHeader,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://vtopcc.vit.ac.in/vtop/admissions/costCentreCircularsViewPageController",
      },
      redirect: "follow",
    });

    const contentType = downloadRes.headers.get("content-type") || "application/pdf";
    if (!downloadRes.ok) {
      const snippet = await downloadRes.text().then(t => t.replace(/\s+/g, " ").trim().substring(0, 300)).catch(() => "");
      return NextResponse.json({ success: false, error: `VTOP returned ${downloadRes.status}`, snippet }, { status: 502 });
    }

    const contentDisposition = downloadRes.headers.get("content-disposition") || `attachment; filename="circular.pdf"`;
    return new NextResponse(downloadRes.body as unknown as BodyInit, {
      status: 200,
      headers: { "Content-Type": contentType, "Content-Disposition": contentDisposition },
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: publicErrorMessage(err) }, { status: 500 });
  }
}
