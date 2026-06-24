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
      Cookie: cookieHeader, "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
    };

    const INIT_URL = "/vtop/examinations/arrearRegistration/viewRARExamSchedule";
    const initResp = await client.post(INIT_URL, new URLSearchParams({ verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString() }).toString(), { headers });
    const $ = cheerio.load(initResp.data);

    let semFieldName = "semesterSubId";
    $("select").each((_, el) => {
      const name = $(el).attr("name") || $(el).attr("id") || "";
      let hasSem = false;
      $(el).find("option").each((__, o) => { const t = $(o).text().trim().toLowerCase(); if (t.includes("sem") || t.includes("fall") || t.includes("winter") || t.includes("summer")) hasSem = true; });
      if (hasSem && name) semFieldName = name;
    });

    const options: { value: string; text: string }[] = [];
    $(`select[name="${semFieldName}"] option, select[id="${semFieldName}"] option`).each((_, el) => {
      const v = $(el).attr("value");
      if (v && v !== "null" && v !== "") options.push({ value: v, text: $(el).text().trim() });
    });

    const semesters: Record<string, any> = {};
    for (const opt of options) {
      try {
        const dataResp = await client.post(INIT_URL, new URLSearchParams({ authorizedID, x: new Date().toUTCString(), [semFieldName]: opt.value, _csrf: csrf }).toString(), { headers });
        semesters[opt.text] = { ...parseVtopHtml(dataResp.data) };
      } catch (e: any) { semesters[opt.text] = { error: e.message }; }
    }
    return NextResponse.json({ success: true, semesters });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
