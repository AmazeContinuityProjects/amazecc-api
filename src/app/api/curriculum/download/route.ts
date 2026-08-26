/**
 * @openapi
 * /api/curriculum/download:
 *   post:
 *     tags:
 *       - Curriculum
 *     summary: Auto-generated POST endpoint for /api/curriculum/download
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

 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });
    }

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    // Submit the curriculum download form
    const body = new URLSearchParams();
    body.append("_csrf", csrf);
    body.append("_csrf", csrf);
    body.append("authorizedID", authorizedID);
    body.append("regNo", "NONE");

    const downloadRes = await fetch(
      "https://vtopcc.vit.ac.in/vtop/academics/curriculDown",
      {
        method: "POST",
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://vtopcc.vit.ac.in/vtop/academics/common/Curriculum",
        },
        body,
        redirect: "follow",
      }
    );

    const contentType = downloadRes.headers.get("content-type") || "application/octet-stream";
    if (!downloadRes.ok) {
      const snippet = await downloadRes.text().then(t => t.replace(/\s+/g, " ").trim().substring(0, 300)).catch(() => "");
      console.error("curriculum download fail:", downloadRes.status, contentType, snippet.substring(0, 200));
      return NextResponse.json({
        success: false,
        error: `VTOP returned ${downloadRes.status} ${contentType}`,
        snippet,
      }, { status: 502 });
    }

    const fallbackExt = contentType.includes("zip") ? "zip" : "pdf";
    const contentDisposition = downloadRes.headers.get("content-disposition") || `attachment; filename="curriculum.${fallbackExt}"`;
    return new NextResponse(downloadRes.body as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
      },
    });
  } catch (err: unknown) {
    console.error("curriculum download error:", (err instanceof Error ? err.message : String(err)));
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
