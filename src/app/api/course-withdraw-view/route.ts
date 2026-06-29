/**
 * @openapi
 * /api/course-withdraw-view:
 *   post:
 *     tags:
 *       - Course Withdraw View
 *     summary: Auto-generated POST endpoint for /api/course-withdraw-view
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
 *               semesterId:
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
 *                 semesterId: "sample_value"
 *                 success: true
 *                 parseVtopHtml(resp.data): "sample_value"
 *                 parseVtopHtml(dataResp.data): "sample_value"
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
    const { cookies, authorizedID, csrf, semesterId } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });
    }
    const client = VTOPClient();
    const headers = {
      Cookie: cookieHeader,
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
    };
    const resp = await client.post(
      "/vtop/academics/common/CourseWithDraw",
      new URLSearchParams({
        verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
      }).toString(),
      { headers }
    );
    if (semesterId) {
      const dataResp = await client.post(
        "/vtop/academics/processCourseWithDrawView",
        new URLSearchParams({
          authorizedID, x: new Date().toUTCString(),
          semesterSubId: semesterId, _csrf: csrf,
        }).toString(),
        { headers }
      );
      return NextResponse.json({ success: true, semesterId, ...parseVtopHtml(dataResp.data) });
    }
    return NextResponse.json({ success: true, ...parseVtopHtml(resp.data) });
  } catch (err: any) {
    console.error("course-withdraw-view error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
