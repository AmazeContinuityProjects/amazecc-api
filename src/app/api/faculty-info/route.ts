import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import { parseFacultyInfo } from "@/lib/parsers/faculty-info";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";
import * as cheerio from "cheerio";

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
        "/vtop/hrms/employeeSearchForStudent",
        new URLSearchParams({
          ...hiddenFields,
          authorizedID,
          _csrf: csrf,
          searchEmployee: searchTerm,
          x: Date.now().toString(),
        }).toString(),
        { headers }
      );

      const parsed = parseVtopHtml(searchResp.data);
      return NextResponse.json({ success: true, results: parsed });
    }

    const data = parseFacultyInfo(resp.data);
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error("faculty-info error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
