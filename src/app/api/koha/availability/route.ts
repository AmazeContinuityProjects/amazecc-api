/**
 * @openapi
 * /api/koha/availability:
 *   get:
 *     tags:
 *       - Koha
 *     summary: Auto-generated GET endpoint for /api/koha/availability
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               biblionumbers:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 success: true
 *                 items: "sample_value"
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

function fetchJson(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    https.get(url, { agent: new https.Agent({ rejectUnauthorized: false }), headers: { "User-Agent": "Mozilla/5.0 (compatible; AmazeCC/1.0)" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`Koha returned ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Invalid JSON from Koha"));
        }
      });
    }).on("error", reject);
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const biblioIds = (searchParams.get("biblionumbers") || "").split(",").filter(Boolean);

    if (biblioIds.length === 0) {
      return NextResponse.json({ success: true, items: [] });
    }

    const results = await Promise.allSettled(
      biblioIds.map((id) => fetchJson(`${KOHA_API}/public/biblios/${id}/items`))
    );

    const itemsMap: Record<string, unknown[]> = {};
    biblioIds.forEach((id, i) => {
      if (results[i].status === "fulfilled") {
        const items = ((results[i] as unknown) as { value: unknown[] }).value || [];
        itemsMap[id] = (items as Record<string, unknown>[]).map((it: Record<string, unknown>) => ({
          itemId: it.item_id as string,
          barcode: it.external_id as string,
          homeLibrary: it.home_library_id as string,
          holdingLibrary: it.holding_library_id as string,
          location: it.location as string,
          callNumber: it.callnumber as string,
          status: it.not_for_loan_status
            ? "Not for loan"
            : it.damaged_status
              ? "Damaged"
              : it.lost_status
                ? "Lost"
                : it.checked_out_date
                  ? "Checked out"
                  : "Available",
          dueDate: (it.checked_out_date as string) || null,
        }));
      }
    });

    return NextResponse.json({ success: true, items: itemsMap });
  } catch (err: unknown) {
    console.error("koha/availability error:", (err instanceof Error ? err.message : String(err)));
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
