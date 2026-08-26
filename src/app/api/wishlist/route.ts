/**
 * @openapi
 * /api/wishlist:
 *   post:
 *     tags:
 *       - Wishlist
 *     summary: Auto-generated POST endpoint for /api/wishlist
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
 *               example:
 *                 semesters: "sample_value"
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
import * as cheerio from "cheerio";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf } = await req.json().catch(() => ({}));
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

    const INIT_URL = "/vtop/academics/registration/wishlistRegPage";
    const initResp = await client.post(
      INIT_URL,
      new URLSearchParams({
        verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
      }).toString(),
      { headers }
    );
    const $ = cheerio.load(initResp.data);

    let semFieldName = "semesterSubId";
    const allSelects = $("select");
    allSelects.each((_, el) => {
      const name = $(el).attr("name") || $(el).attr("id") || "";
      const opts = $(el).find("option");
      let hasSemOption = false;
      opts.each((__, opt) => {
        const txt = $(opt).text().trim().toLowerCase();
        if (txt.includes("sem") || txt.includes("fall") || txt.includes("winter") || txt.includes("summer")) hasSemOption = true;
      });
      if (hasSemOption && name) semFieldName = name;
    });

    const options: { value: string; text: string }[] = [];
    $(`select[name="${semFieldName}"] option, select[id="${semFieldName}"] option`).each((_, el) => {
      const v = $(el).attr("value");
      if (v && v !== "null" && v !== "") options.push({ value: v, text: $(el).text().trim() });
    });

    const semesters: Record<string, unknown> = {};
    for (const opt of options) {
      try {
        const dataResp = await client.post(
          INIT_URL,
          new URLSearchParams({
            authorizedID, x: new Date().toUTCString(),
            [semFieldName]: opt.value, _csrf: csrf,
          }).toString(),
          { headers }
        );
        semesters[opt.text] = { ...parseVtopHtml(dataResp.data) };
      } catch (e: unknown) {
        semesters[opt.text] = { error: (e instanceof Error ? e.message : String(e)) };
      }
    }
    return NextResponse.json({ success: true, semesters });
  } catch (err: unknown) {
    console.error("wishlist error:", (err instanceof Error ? err.message : String(err)));
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
