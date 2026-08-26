/**
 * @openapi
 * /api/qcm-view:
 *   post:
 *     tags:
 *       - Qcm View
 *     summary: Auto-generated POST endpoint for /api/qcm-view
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
 *                 semesters: "sample_value"
 *                 success: true
 *                 data: "sample_value"
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

function camelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (m, i) =>
      i === 0 ? m.toLowerCase() : m.toUpperCase()
    )
    .replace(/\s+/g, "");
}

function extractTables($$: cheerio.CheerioAPI): { caption?: string; headers: string[]; rows: Record<string, string>[] }[] {
  const tables: { caption?: string; headers: string[]; rows: Record<string, string>[] }[] = [];

  $$("table").each((_, table) => {
    const $table = $$(table);
    // Skip layout/wrapper tables with no real data
    if ($table.find("table").length > 0 && $table.find("tr").length <= 2) return;

    const caption = $table.find("caption").first().text().trim() || undefined;
    const headers: string[] = [];
    const rows: Record<string, string>[] = [];

    // Try thead > tr > th first
    const $thead = $table.find("thead tr").first();
    if ($thead.length > 0) {
      $thead.find("th, td").each((_, cell) => {
        const text = $$(cell).text().trim();
        if (text) headers.push(text);
      });
    }

    // Fallback: first tr with th cells
    if (headers.length === 0) {
      const $firstRow = $table.find("tr").first();
      $firstRow.find("th").each((_, cell) => {
        const text = $$(cell).text().trim();
        if (text) headers.push(text);
      });
      // Fallback: first tr with td that looks like headers (bold or specific styling)
      if (headers.length === 0) {
        $firstRow.find("td").each((_, cell) => {
          const text = $$(cell).text().trim();
          const colspan = $$(cell).attr("colspan");
          if (text && colspan !== "13" && text.length < 100) headers.push(text);
        });
      }
    }

    // Extract body rows (skip the header row)
    const startSlice = headers.length > 0 ? 1 : 0;
    const $bodyRows = $table.find("tbody tr").length > 0
      ? $table.find("tbody tr")
      : $table.find("tr").slice(startSlice);

    $bodyRows.each((_, row) => {
      const rowData: Record<string, string> = {};
      $$(row).find("td").each((i, cell) => {
        const text = $$(cell).text().trim();
        if (text) rowData[headers[i] || `col${i}`] = text;
      });
      if (Object.keys(rowData).length > 0) rows.push(rowData);
    });

    if (headers.length > 0 && rows.length > 0) {
      tables.push({ caption, headers, rows });
    }
  });

  return tables;
}

function extractKeyValuePairs($$: cheerio.CheerioAPI): Record<string, string> {
  const kvPairs: Record<string, string> = {};

  // Method 1: 2-column table rows (label | value)
  $$("table").each((_, table) => {
    $$(table).find("tr").each((_, row) => {
      const cells = $$(row).find("td");
      if (cells.length === 2) {
        const label = $$(cells[0]).text().trim().replace(/\s+/g, " ");
        const value = $$(cells[1]).text().trim();
        if (label && value && label !== value && label.length < 80 && !label.startsWith("<")) {
          kvPairs[camelCase(label)] = value;
        }
      }
    });
  });

  // Method 2: dt/dd pairs
  $$("dl").each((_, dl) => {
    $$(dl).find("dt").each((i, dt) => {
      const label = $$(dt).text().trim();
      const dd = $$(dt).next("dd");
      const value = dd.text().trim();
      if (label && value) {
        kvPairs[camelCase(label)] = value;
      }
    });
  });

  // Method 3: label + span/div pairs in form groups
  $$(".form-group, .row").each((_, group) => {
    const label = $$(group).find("label").first().text().trim();
    const value = $$(group).find("span, .form-control-static, p").first().text().trim()
      || $$(group).find("input").first().val() as string;
    if (label && value && label.length < 80) {
      kvPairs[camelCase(label)] = String(value);
    }
  });

  return kvPairs;
}

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf, semesterId } = await req.json().catch(() => ({}));
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

    // Step 1: Load the initial QCM page to get semester list
    const initRes = await client.post(
      "/vtop/academics/common/QCMStudentLogin",
      new URLSearchParams({
        verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
      }).toString(),
      { headers }
    );

    const $ = cheerio.load(initRes.data);
    const pageCsrf = $('input[name="_csrf"]').val() as string || csrf;
    const semesterIds: { value: string; text: string }[] = [];

    $("#semesterSubId option").each((_, opt) => {
      const val = $(opt).attr("value") || "";
      if (val) semesterIds.push({ value: val, text: $(opt).text().trim() });
    });

    // If a specific semester was requested, only fetch that one
    const semsToFetch = semesterId
      ? semesterIds.filter(s => s.value === semesterId)
      : semesterIds;

    const allSemesterData: Record<string, unknown> = {};

    for (const sem of semsToFetch) {
      try {
        // Step 2: Fetch QCM data for each semester via AJAX
        const dataRes = await client.post(
          "/vtop/getStudentLoginForQcm",
          new URLSearchParams({
            _csrf: pageCsrf,
            authorizedID,
            semSubId: sem.value,
            paramReturnId: "getStudentLoginForQcm",
            x: Date.now().toString(),
          }).toString(),
          { headers }
        );

        const responseHtml = dataRes.data;
        const $$ = cheerio.load(responseHtml);

        // Extract from the paramReturnId target div if present
        const $target = $$("#getStudentLoginForQcm");
        const parseRoot = $target.length > 0 ? cheerio.load($target.html() || responseHtml) : $$;

        const tables = extractTables(parseRoot);
        const rawKvPairs = extractKeyValuePairs(parseRoot);

        // Deduplicate: remove KV pairs whose keys match table headers or
        // whose values already appear in table rows
        const tableHeaderKeys = new Set<string>();
        const tableValues = new Set<string>();
        for (const table of tables) {
          for (const h of table.headers) {
            tableHeaderKeys.add(camelCase(h));
          }
          for (const row of table.rows) {
            for (const val of Object.values(row)) {
              tableValues.add(val.trim());
            }
          }
        }
        const keyValuePairs: Record<string, string> = {};
        for (const [key, val] of Object.entries(rawKvPairs)) {
          if (!tableHeaderKeys.has(key) && !tableValues.has(val)) {
            keyValuePairs[key] = val;
          }
        }

        // Also check for any alert/message divs
        const messages: string[] = [];
        parseRoot(".alert, .box-body > p, .callout, .info-box-text").each((_, el) => {
          const text = parseRoot(el).text().trim();
          if (text && text.length > 3) messages.push(text);
        });

        // Extract plain text content if no tables or KV pairs found
        let plainText: string | undefined;
        if (tables.length === 0 && Object.keys(keyValuePairs).length === 0) {
          const bodyText = parseRoot("body").text().trim() || parseRoot.root().text().trim();
          const cleaned = bodyText.replace(/\s+/g, " ").trim();
          if (cleaned && cleaned.length > 3) plainText = cleaned;
        }

        allSemesterData[sem.value] = {
          semester: sem.text,
          tables,
          keyValuePairs,
          ...(messages.length > 0 ? { messages } : {}),
          ...(plainText ? { plainText } : {}),
        };
      } catch (err: unknown) {
        allSemesterData[sem.value] = { semester: sem.text, error: (err instanceof Error ? err.message : String(err)) };
      }
    }

    return NextResponse.json({
      success: true,
      semesters: semesterIds,
      data: allSemesterData,
    });
  } catch (err: unknown) {
    console.error("qcm-view error:", (err instanceof Error ? err.message : String(err)));
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
