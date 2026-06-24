import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import * as cheerio from "cheerio";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf, formData } = await req.json().catch(() => ({}));
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

    const INIT_URL = "/vtop/hrms/onlineBookRecommendation";

    if (formData) {
      const initResp = await client.post(INIT_URL, new URLSearchParams({
        verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
      }).toString(), { headers });
      const $ = cheerio.load(initResp.data);
      const hiddenFields: Record<string, string> = {};
      $("input[type=hidden]").each((_, el) => {
        const name = $(el).attr("name") || "";
        const val = $(el).attr("value") || "";
        if (name) hiddenFields[name] = val;
      });
      const allFields = { ...hiddenFields, ...formData };
      const submitResp = await client.post(INIT_URL, new URLSearchParams(allFields).toString(), { headers });
      return NextResponse.json({ success: true, ...parseVtopHtml(submitResp.data) });
    }

    const resp = await client.post(INIT_URL, new URLSearchParams({
      verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
    }).toString(), { headers });
    return NextResponse.json({ success: true, ...parseVtopHtml(resp.data) });
  } catch (err: any) {
    console.error("book-recommendation error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
