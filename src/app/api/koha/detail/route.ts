/**
 * @openapi
 * /api/koha/detail:
 *   get:
 *     tags:
 *       - Koha
 *     summary: Auto-generated GET endpoint for /api/koha/detail
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               biblionumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object

 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

import { NextRequest, NextResponse } from "next/server";
import https from "https";

const KOHA_API = "https://webopaccc.vit.ac.in/api/v1";

function isValidBiblionumber(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

function fetchJson(url: string, accept?: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0 (compatible; AmazeCC/1.0)" };
    if (accept) headers["Accept"] = accept;
    https.get(url, { agent: new https.Agent({ rejectUnauthorized: false }), headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`Koha returned ${res.statusCode}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Invalid JSON from Koha")); }
      });
    }).on("error", reject);
  });
}

function getSubfields(fields: Record<string, unknown>[], tag: string, code?: string): string[] {
  const results: string[] = [];
  for (const f of fields) {
    const key = Object.keys(f)[0] as string;
    if (key && key.startsWith(tag)) {
      const subfields = ((f[key] as Record<string, unknown>)?.subfields as Record<string, unknown>[] | undefined) || [];
      for (const sf of subfields as Record<string, unknown>[]) {
        const sfKey = Object.keys(sf)[0] as string;
        if (!code || sfKey === code) {
          results.push(sf[sfKey] as string);
        }
      }
    }
  }
  return results;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const biblionumber = searchParams.get("biblionumber") || "";

    if (!biblionumber) {
      return NextResponse.json({ success: false, error: "biblionumber is required" }, { status: 400 });
    }
    if (!isValidBiblionumber(biblionumber)) {
      return NextResponse.json({ success: false, error: "invalid biblionumber format" }, { status: 400 });
    }

    const encodedBiblionumber = encodeURIComponent(biblionumber);
    const marcUrl = new URL(`${KOHA_API}/public/biblios/${encodedBiblionumber}`).toString();
    const itemsUrl = new URL(`${KOHA_API}/public/biblios/${encodedBiblionumber}/items`).toString();

    const [marcData, itemsData] = await Promise.allSettled([
      fetchJson(marcUrl, "application/marc-in-json"),
      fetchJson(itemsUrl),
    ]);

    const fields = marcData.status === "fulfilled" ? (((marcData.value as Record<string, unknown>)?.fields as Record<string, unknown>[] | undefined) || []) : [];

    const title = getSubfields(fields as Record<string, unknown>[], "245", "a").join(" ");
    const author = getSubfields(fields as Record<string, unknown>[], "100", "a").join(" ") || getSubfields(fields as Record<string, unknown>[], "700", "a").join("; ");
    const isbn = getSubfields(fields as Record<string, unknown>[], "020", "a").join(", ");
    const edition = getSubfields(fields as Record<string, unknown>[], "250", "a").join(" ");
    const publisherName = getSubfields(fields as Record<string, unknown>[], "260", "b").join(" ");
    const publisherDate = getSubfields(fields as Record<string, unknown>[], "260", "c").join(" ");
    const publisher = [publisherName, publisherDate].filter(Boolean).join(" ");
    const description = getSubfields(fields as Record<string, unknown>[], "300", "a").join(" ");
    const ddc = getSubfields(fields as Record<string, unknown>[], "082", "a").join(" ");
    const subjects = getSubfields(fields as Record<string, unknown>[], "650", "a");
    const summary = getSubfields(fields as Record<string, unknown>[], "520", "a").join(" ");
    const holdings: Array<Record<string, unknown>> = [];
    if (itemsData.status === "fulfilled" && Array.isArray((itemsData as unknown as { value: unknown }).value)) {
      for (const it of (itemsData as unknown as { value: Record<string, unknown>[] }).value) {
        holdings.push({
          itemId: it.item_id as string,
          barcode: it.external_id as string,
          currentLibrary: it.home_library_id as string,
          homeLibrary: it.holding_library_id as string,
          shelvingLocation: it.location as string,
          callNumber: it.callnumber as string,
          status: it.not_for_loan_status
            ? "Not for loan"
            : it.damaged_status ? "Damaged"
            : it.lost_status ? "Lost"
            : it.checked_out_date ? "Checked out"
            : "Available",
          dateDue: (it.date_due as string) || null,
          notes: (it.notes as string) || "",
        });
      }
    }

    return NextResponse.json({
      success: true,
      book: {
        biblionumber,
        title,
        author,
        publisher,
        edition,
        description,
        isbn,
        subjects,
        ddc,
        summary,
        holdings,
      },
    });
  } catch (err: unknown) {
    console.error("koha/detail error:", (err instanceof Error ? err.message : String(err)));
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
