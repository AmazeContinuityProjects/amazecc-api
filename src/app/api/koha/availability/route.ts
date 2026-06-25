import { NextRequest, NextResponse } from "next/server";
import https from "https";

const KOHA_API = "https://webopaccc.vit.ac.in/api/v1";

function fetchJson(url: string): Promise<any> {
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

    const itemsMap: Record<string, any[]> = {};
    biblioIds.forEach((id, i) => {
      if (results[i].status === "fulfilled") {
        const items = (results[i] as any).value || [];
        itemsMap[id] = items.map((it: any) => ({
          itemId: it.item_id,
          barcode: it.external_id,
          homeLibrary: it.home_library_id,
          holdingLibrary: it.holding_library_id,
          location: it.location,
          callNumber: it.callnumber,
          status: it.not_for_loan_status
            ? "Not for loan"
            : it.damaged_status
              ? "Damaged"
              : it.lost_status
                ? "Lost"
                : it.checked_out_date
                  ? "Checked out"
                  : "Available",
          dueDate: it.checked_out_date || null,
        }));
      }
    });

    return NextResponse.json({ success: true, items: itemsMap });
  } catch (err: any) {
    console.error("koha/availability error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
