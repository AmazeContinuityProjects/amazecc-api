/**
 * @openapi
 * /api/koha/search:
 *   get:
 *     tags:
 *       - Koha
 *     summary: Auto-generated GET endpoint for /api/koha/search
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idx:
 *                 type: string
 *               q:
 *                 type: string
 *               count:
 *                 type: string
 *               offset:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 query: "sample_value"
 *                 offset: "sample_value"
 *                 count: "sample_value"
 *                 books: "sample_value"
 *                 total: "sample_value"
 *                 success: true
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import https from "https";

const KOHA_OPAC = "https://webopaccc.vit.ac.in/cgi-bin/koha";

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { agent: new https.Agent({ rejectUnauthorized: false }), headers: { "User-Agent": "Mozilla/5.0 (compatible; AmazeCC/1.0)" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchText(new URL(res.headers.location, url).toString()).then(resolve).catch(reject);
          return;
        }
        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`Koha returned ${res.statusCode}`));
          return;
        }
        resolve(data);
      });
    }).on("error", reject);
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const idx = searchParams.get("idx") || "kw";
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const count = Math.min(parseInt(searchParams.get("count") || "20", 10), 100);

    if (!q.trim()) {
      return NextResponse.json({ success: true, books: [], total: 0 });
    }

    const rssUrl = `${KOHA_OPAC}/opac-search.pl?idx=${encodeURIComponent(idx)}&q=${encodeURIComponent(q)}&count=${count}&offset=${offset}&sort_by=relevance&format=rss`;
    const xml = await fetchText(rssUrl);

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      isArray: (tag) => ["item", "channel", "rss"].includes(tag),
    });
    const parsed = parser.parse(xml);
    const channel = parsed?.rss?.[0]?.channel?.[0] || {};
    const total = parseInt(channel?.["opensearch:totalResults"] || "0", 10);
    const rawItems = channel?.item || [];

    const books = rawItems.map((item: any) => {
      const title = (typeof item.title === "string" ? item.title : item.title?.[0] || "").trim();
      const link = typeof item.link === "string" ? item.link : item.link?.[0] || "";
      const biblionumber = link.match(/biblionumber=(\d+)/)?.[1] || "";
      const identifier = (typeof item["dc:identifier"] === "string" ? item["dc:identifier"] : item["dc:identifier"]?.[0] || "").replace(/^ISBN:/i, "");
      const desc = typeof item.description === "string" ? item.description : item.description?.[0] || "";

      let author = "";
      let publisher = "";
      let coverUrl = "";

      const imgMatch = desc.match(/<img\s+src="([^"]+)"[^>]*\/?>/i);
      if (imgMatch) coverUrl = imgMatch[1];

      const byMatch = desc.match(/By\s+(.+?)\.\s+([\s\S]+?)\s+(\d{4})\b/i);
      if (byMatch) {
        author = byMatch[1].trim();
        publisher = `${byMatch[2].trim()} ${byMatch[3]}`.replace(/\s+/g, " ");
      }

      return { biblionumber, title, author, publisher, isbn: identifier, coverUrl };
    });

    return NextResponse.json({ success: true, books, total, query: q, offset, count });
  } catch (err: any) {
    console.error("koha/search error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
