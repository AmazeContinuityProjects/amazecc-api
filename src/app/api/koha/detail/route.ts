import { NextRequest, NextResponse } from "next/server";
import https from "https";

const KOHA_API = "https://webopaccc.vit.ac.in/api/v1";

function fetchJson(url: string, accept?: string): Promise<any> {
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

function getSubfields(fields: any[], tag: string, code?: string): string[] {
  const results: string[] = [];
  for (const f of fields) {
    const key = Object.keys(f)[0];
    if (key.startsWith(tag)) {
      const subfields = f[key]?.subfields || [];
      for (const sf of subfields) {
        const sfKey = Object.keys(sf)[0];
        if (!code || sfKey === code) {
          results.push(sf[sfKey]);
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

    const [marcData, itemsData] = await Promise.allSettled([
      fetchJson(`${KOHA_API}/public/biblios/${biblionumber}`, "application/marc-in-json"),
      fetchJson(`${KOHA_API}/public/biblios/${biblionumber}/items`),
    ]);

    const fields = marcData.status === "fulfilled" ? (marcData.value?.fields || []) : [];

    const title = getSubfields(fields, "245", "a").join(" ");
    const author = getSubfields(fields, "100", "a").join(" ") || getSubfields(fields, "700", "a").join("; ");
    const isbn = getSubfields(fields, "020", "a").join(", ");
    const edition = getSubfields(fields, "250", "a").join(" ");
    const publisherName = getSubfields(fields, "260", "b").join(" ");
    const publisherDate = getSubfields(fields, "260", "c").join(" ");
    const publisher = [publisherName, publisherDate].filter(Boolean).join(" ");
    const description = getSubfields(fields, "300", "a").join(" ");
    const ddc = getSubfields(fields, "082", "a").join(" ");
    const subjects = getSubfields(fields, "650", "a");
    const summary = getSubfields(fields, "520", "a").join(" ");
    const isbnClean = isbn.replace(/[^0-9X]/gi, "").slice(0, 13);
    const coverUrl = isbnClean ? `https://covers.openlibrary.org/b/isbn/${isbnClean}-L.jpg` : "";

    const holdings: any[] = [];
    if (itemsData.status === "fulfilled" && Array.isArray(itemsData.value)) {
      for (const it of itemsData.value) {
        holdings.push({
          itemId: it.item_id,
          barcode: it.external_id,
          currentLibrary: it.home_library_id,
          homeLibrary: it.holding_library_id,
          shelvingLocation: it.location,
          callNumber: it.callnumber,
          status: it.not_for_loan_status
            ? "Not for loan"
            : it.damaged_status ? "Damaged"
            : it.lost_status ? "Lost"
            : it.checked_out_date ? "Checked out"
            : "Available",
          dateDue: it.date_due || null,
          notes: it.notes || "",
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
  } catch (err: any) {
    console.error("koha/detail error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
