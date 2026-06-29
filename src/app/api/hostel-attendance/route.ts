/**
 * @openapi
 * /api/hostel-attendance:
 *   post:
 *     tags:
 *       - Hostel Attendance
 *     summary: Auto-generated POST endpoint for /api/hostel-attendance
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               csrf:
 *                 type: string
 *               year:
 *                 type: string
 *               month:
 *                 type: string
 *               authorizedID:
 *                 type: string
 *               cookies:
 *                 type: string
 *               semesterId:
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
    const { cookies, authorizedID, csrf, semesterId, year, month } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });
    }
    const client = VTOPClient();
    if (semesterId || (year && month)) {
      const resp = await client.post(
        "/vtop/hostels/student/month/attendance/report/2",
        new URLSearchParams({
          authorizedID: String(authorizedID),
          x: new Date().toUTCString(),
          reportYear: String(year || ""),
          reportMonth: String(month || ""),
          _csrf: String(csrf),
        }).toString(),
        {
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/x-www-form-urlencoded",
            Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
          },
        }
      );
      return NextResponse.json({ success: true, semesterId, ...parseVtopHtml(resp.data) });
    }
    const resp = await client.post(
      "/vtop/hostels/student/month/attendance/report/1",
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
    console.error("hostel-attendance error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
