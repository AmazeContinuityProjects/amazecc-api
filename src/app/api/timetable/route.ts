/**
 * @openapi
 * /api/timetable:
 *   post:
 *     tags:
 *       - Timetable
 *     summary: Auto-generated POST endpoint for /api/timetable
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
 *                 courseInfo: "sample_value"
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
import fetchTimetable from "@/lib/fetchTimeTable";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf, semesterId } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });
    }

    if (semesterId) {
      const courseInfo = await fetchTimetable(cookieHeader, authorizedID, csrf, semesterId);
      return NextResponse.json({ success: true, semesterId, courseInfo });
    }

    const client = VTOPClient();
    const resp = await client.post(
      "/vtop/academics/common/StudentTimeTableChn",
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
    return NextResponse.json({ success: true, ...parseVtopHtml(resp.data) });
  } catch (err: any) {
    console.error("timetable error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
