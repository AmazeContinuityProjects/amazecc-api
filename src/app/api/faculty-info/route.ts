/**
 * @openapi
 * /api/faculty-info:
 *   post:
 *     tags:
 *       - Faculty Info
 *     summary: Auto-generated POST endpoint for /api/faculty-info
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               searchTerm:
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
 *                 success: true
 *                 data: "sample_value"
 *                 results: "sample_value"
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
import { parseFacultyInfo } from "@/lib/parsers/faculty-info";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";
import * as cheerio from "cheerio";
import { writeFileSync } from "fs";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf, searchTerm } = await req.json().catch(() => ({}));
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
      "/vtop/hrms/employeeSearchForStudent",
      new URLSearchParams({
        verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
      }).toString(),
      { headers }
    );

    if (searchTerm) {
      const $ = cheerio.load(resp.data);
      const hiddenFields: Record<string, string> = {};
      $("input[type=hidden]").each((_, el) => {
        const name = $(el).attr("name") || "";
        const val = $(el).attr("value") || "";
        if (name) hiddenFields[name] = val;
      });

      const searchResp = await client.post(
        "/vtop/hrms/EmployeeSearchForStudent",
        new URLSearchParams({
          _csrf: csrf,
          authorizedID,
          x: new Date().toUTCString(),
          empId: searchTerm.toUpperCase(),
        }).toString(),
        { headers }
      );

      const parsed = parseVtopHtml(searchResp.data);
      
      // DEBUG: write HTML to file
      writeFileSync("c:/Users/sugee/Documents/Testing/vtop-faculty-search-debug.html", searchResp.data);

      return NextResponse.json({ success: true, results: parsed });
    }

    const data = parseFacultyInfo(resp.data);
    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    console.error("faculty-info error:", (err instanceof Error ? err.message : String(err)));
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
