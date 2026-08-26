/**
 * @openapi
 * /api/feedback-status:
 *   post:
 *     tags:
 *       - Feedback Status
 *     summary: Auto-generated POST endpoint for /api/feedback-status
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
 *                 data: "sample_value"
 *                 semesterId: "sample_value"
 *                 success: true
 *                 semesterData: "sample_value"
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
import { parseFeedbackStatus } from "@/lib/parsers/feedback-status";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf, semesterId } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });
    }
    const client = VTOPClient();
    if (semesterId) {
      const resp = await client.post(
        "/vtop/processViewFeedBackStatus",
        new URLSearchParams({
          authorizedID: String(authorizedID),
          semesterSubId: semesterId,
          _csrf: String(csrf),
          x: new Date().toUTCString(),
        }).toString(),
        {
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/x-www-form-urlencoded",
            Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
          },
        }
      );
      const semesterData = parseFeedbackStatus(resp.data);
      return NextResponse.json({ success: true, semesterId, ...semesterData });
    }
    const resp = await client.post(
      "/vtop/academics/common/FeedBackStatusStudent",
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
    const data = parseFeedbackStatus(resp.data);
    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    console.error("feedback-status error:", (err instanceof Error ? err.message : String(err)));
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
