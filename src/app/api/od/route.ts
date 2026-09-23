/**
 * @openapi
 * /api/od:
 *   post:
 *     tags:
 *       - OD Details
 *     summary: Student OD (On Duty) details for a semester
 *     description: >
 *       Scrapes VTOP "Student OD Details" (`academics/common/getStudentOdDetails`
 *       → `searchStudentOdDetails`). Returns one row per OD grant with Type,
 *       Reason, Basis, Date, Time and Remarks so students can see why each
 *       OD was given, plus the VTOP total OD count badge.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cookies
 *               - authorizedID
 *               - csrf
 *               - semesterId
 *             properties:
 *               cookies:
 *                 type: string
 *                 description: VTOP session cookies from /api/login
 *               authorizedID:
 *                 type: string
 *                 description: VTOP authorized ID from /api/login
 *               csrf:
 *                 type: string
 *                 description: CSRF token from /api/login
 *               semesterId:
 *                 type: string
 *                 description: Semester sub ID, e.g. CH20262701 (Fall Semester 2026-27)
 *                 example: CH20262701
 *     responses:
 *       200:
 *         description: OD details for the semester
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 semesterId:
 *                   type: string
 *                 totalCount:
 *                   type: number
 *                 note:
 *                   type: string
 *                   nullable: true
 *                 records:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       slNo:
 *                         type: string
 *                       type:
 *                         type: string
 *                       reason:
 *                         type: string
 *                       basis:
 *                         type: string
 *                       date:
 *                         type: string
 *                       time:
 *                         type: string
 *                       remarks:
 *                         type: string
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 */

import { NextResponse } from "next/server";
import VTOPClient, { getVtopReferer } from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import { parseOdDetails } from "@/lib/parsers/od-details";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf, semesterId } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });
    }
    if (!semesterId) {
      return NextResponse.json({ error: "Missing semesterId (e.g. CH20262701)" }, { status: 400 });
    }

    const client = VTOPClient();
    const headers = {
      Cookie: cookieHeader,
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: getVtopReferer(),
    };

    // Warm the menu session exactly like the browser (verifyMenu shell first)
    await client.post(
      "/vtop/academics/common/getStudentOdDetails",
      new URLSearchParams({
        verifyMenu: "true",
        authorizedID: String(authorizedID),
        _csrf: String(csrf),
        nocache: Date.now().toString(),
      }).toString(),
      { headers }
    );

    // Fetch the OD table fragment (relative "searchStudentOdDetails"
    // resolves against <base href=".../vtop/">)
    const resp = await client.post(
      "/vtop/searchStudentOdDetails",
      new URLSearchParams({
        authorizedID: String(authorizedID),
        semesterSubId: String(semesterId),
        _csrf: String(csrf),
      }).toString(),
      { headers }
    );

    const data = parseOdDetails(String(resp.data ?? ""), String(semesterId));
    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    console.error("od error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
