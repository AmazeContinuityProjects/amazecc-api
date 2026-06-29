/**
 * @openapi
 * /api/minor-honour:
 *   post:
 *     tags:
 *       - Minor Honour
 *     summary: Auto-generated POST endpoint for /api/minor-honour
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

async function processCascade(
  client: any,
  initUrl: string,
  headers: Record<string, string>,
  baseParams: Record<string, string>,
  selectOptions: Record<string, { value: string; text: string; selected: boolean }[]>,
): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  const processedFields = new Set(Object.keys(baseParams));

  for (const [fieldName, fieldOptions] of Object.entries(selectOptions)) {
    if (processedFields.has(fieldName)) continue;
    const opts = fieldOptions as { value: string; text: string; selected: boolean }[] | undefined;
    if (!opts || opts.length === 0) continue;

    const children: Record<string, any> = {};
    for (const sub of opts) {
      if (!sub.value || sub.value === "null" || sub.value === "") continue;
      const params: Record<string, string> = { ...baseParams, [fieldName]: sub.value, x: new Date().toUTCString() };
      try {
        const resp = await client.post(initUrl, new URLSearchParams(params).toString(), { headers });
        const parsed = parseVtopHtml(resp.data);

        const deeperOptions: Record<string, any> = {};
        for (const [cf, co] of Object.entries(parsed.selectOptions)) {
          if (processedFields.has(cf) || cf === fieldName) continue;
          const childOpts = co as { value: string; text: string; selected: boolean }[] | undefined;
          if (childOpts && childOpts.length > 0) deeperOptions[cf] = childOpts;
        }

        const deeperCascade = Object.keys(deeperOptions).length > 0
          ? await processCascade(client, initUrl, headers, params, deeperOptions)
          : undefined;

        children[sub.text] = {
          selectOptions: deeperOptions,
          tables: parsed.tables || [],
          ...(deeperCascade && Object.keys(deeperCascade).length > 0 ? { cascadingOptions: deeperCascade } : {}),
        };
      } catch (e: any) {
        children[sub.text] = { error: e.message };
      }
    }
    if (Object.keys(children).length > 0)
      result[fieldName] = { options: opts, children };
  }
  return result;
}

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID)
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });

    const client = VTOPClient();
    const INIT_URL = "/vtop/academics/additionalLearning/AdditionalLearningStudentView";
    const REFERER = "https://vtopcc.vit.ac.in" + INIT_URL;
    const headers = {
      Cookie: cookieHeader,
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: REFERER,
    };

    const initResp = await client.post(INIT_URL, new URLSearchParams({
      verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
    }).toString(), { headers });
    const $ = cheerio.load(initResp.data);

    let semFieldName = "semesterSubId";
    $("select").each((_, el) => {
      const name = $(el).attr("name") || $(el).attr("id") || "";
      let hasSem = false;
      $(el).find("option").each((__, o) => {
        const t = $(o).text().trim().toLowerCase();
        if (t.includes("sem") || t.includes("fall") || t.includes("winter") || t.includes("summer")) hasSem = true;
      });
      if (hasSem && name) semFieldName = name;
    });

    const options: { value: string; text: string }[] = [];
    $(`select[name="${semFieldName}"] option, select[id="${semFieldName}"] option`).each((_, el) => {
      const v = $(el).attr("value");
      if (v && v !== "null" && v !== "") options.push({ value: v, text: $(el).text().trim() });
    });

    const hiddenFields: Record<string, string> = {};
    $("input[type=hidden]").each((_, el) => {
      const name = $(el).attr("name") || "";
      const val = $(el).attr("value") || "";
      if (name) hiddenFields[name] = val;
    });

    const semesters: Record<string, any> = {};
    for (const opt of options) {
      try {
        const baseParams: Record<string, string> = {
          authorizedID,
          _csrf: csrf,
          verifyMenu: "true",
          ...hiddenFields,
          [semFieldName]: opt.value,
        };

        const dataResp = await client.post(INIT_URL, new URLSearchParams(baseParams).toString(), { headers });
        const parsed = parseVtopHtml(dataResp.data);
        const semData: any = { ...parsed };

        const cascade = await processCascade(client, INIT_URL, headers, baseParams, parsed.selectOptions);
        if (Object.keys(cascade).length > 0) semData.cascadingOptions = cascade;

        if (parsed.tables?.length > 0 || Object.keys(parsed.keyValuePairs || {}).length > 0 || Object.keys(cascade).length > 0)
          semesters[opt.text] = semData;
      } catch (e: any) {
        semesters[opt.text] = { error: e.message };
      }
    }
    return NextResponse.json({ success: true, semesters });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
