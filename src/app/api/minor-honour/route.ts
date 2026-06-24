import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import * as cheerio from "cheerio";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";

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

    const INIT_URL = "/vtop/academics/additionalLearning/AdditionalLearningStudentView";
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
        const parsed = parseVtopHtml(dataResp.data);

        const semData: any = { ...parsed };

        const cascade: Record<string, any> = {};
        for (const [fieldName, fieldOptions] of Object.entries(parsed.selectOptions)) {
          if (fieldName === semFieldName) continue;
          const opts = fieldOptions as { value: string; text: string; selected: boolean }[] | undefined;
          if (!opts || opts.length === 0) continue;
          const children: Record<string, any> = {};
          for (const sub of opts) {
            if (!sub.value || sub.value === "null" || sub.value === "") continue;
            try {
              const childResp = await client.post(INIT_URL, new URLSearchParams({
                authorizedID, x: new Date().toUTCString(),
                [semFieldName]: opt.value,
                [fieldName]: sub.value,
                _csrf: csrf,
              }).toString(), { headers });
              const childParsed = parseVtopHtml(childResp.data);
              const childSelectOptions: Record<string, any> = {};
              for (const [cf, co] of Object.entries(childParsed.selectOptions)) {
                if (cf === semFieldName || cf === fieldName) continue;
                const childOpts = co as { value: string; text: string; selected: boolean }[] | undefined;
                if (childOpts && childOpts.length > 0) childSelectOptions[cf] = childOpts;
              }
              if (Object.keys(childSelectOptions).length > 0 || childParsed.tables?.length > 0)
                children[sub.text] = { selectOptions: childSelectOptions, tables: childParsed.tables };
            } catch (e: any) {
              children[sub.text] = { error: e.message };
            }
          }
          if (Object.keys(children).length > 0)
            cascade[fieldName] = { options: opts, children };
        }
        if (Object.keys(cascade).length > 0) semData.cascadingOptions = cascade;

        if (parsed.tables?.length > 0 || Object.keys(parsed.keyValuePairs || {}).length > 0 || Object.keys(cascade).length > 0)
          semesters[opt.text] = semData;
      } catch (e: any) { semesters[opt.text] = { error: e.message }; }
    }
    return NextResponse.json({ success: true, semesters });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
