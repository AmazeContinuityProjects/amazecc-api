import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import * as cheerio from "cheerio";
import { parseCompreInfo } from "@/lib/parsers/compre-info";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID)
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });

    const client = VTOPClient();
    const headers = {
      Cookie: cookieHeader, "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
    };

    const INIT_URL = "/vtop/compre/studentExamInfo";
    const initResp = await client.post(INIT_URL, new URLSearchParams({ verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString() }).toString(), { headers });
    const data = parseCompreInfo(initResp.data);
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
