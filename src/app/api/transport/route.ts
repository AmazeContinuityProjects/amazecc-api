import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import * as cheerio from "cheerio";
import { URLSearchParams } from "url";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });
    }

    const client = VTOPClient();
    const resp = await client.post(
      "/vtop/transport/transportRegistration",
      new URLSearchParams({
        verifyMenu: "true",
        authorizedID: String(authorizedID),
        _csrf: String(csrf),
        nocache: Date.now().toString(),
      }).toString(),
      {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const html = resp.data;
    if (!html || typeof html !== "string") {
      return NextResponse.json({ hasRegistration: false, error: "Empty response from VTOP" }, { status: 200 });
    }

    const $ = cheerio.load(html);

    const busRouteId = $("#busRouteId").val() as string || "";

    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

    const tableRows: { label: string; value: string }[] = [];
    $("table.table tr").each((_, row) => {
      const tds = $(row).find("td");
      if (tds.length >= 2) {
        tableRows.push({
          label: normalize($(tds[0]).text()),
          value: normalize($(tds[1]).text()),
        });
      }
    });

    const qrCode = $('#qrAttendance img[src^="data:image"]').attr("src") || "";
    const pageCsrf = $('input[name="_csrf"]').val() as string || csrf;

    const data: Record<string, string> = {};
    for (const row of tableRows) {
      if (row.label.includes("Register Number")) data.registerNumber = row.value;
      else if (row.label.includes("Name of the Student")) data.name = row.value;
      else if (row.label.includes("Programme")) data.programme = row.value;
      else if (row.label.includes("Branch")) data.branch = row.value;
      else if (row.label.includes("Route Selected")) data.routeSelected = row.value;
      else if (row.label.includes("FP Reference Number")) data.fpReference = row.value;
      else if (row.label.includes("Payment Status")) data.paymentStatus = row.value;
    }

    const hasRegistration = !!(busRouteId && data.routeSelected && data.paymentStatus);

    return NextResponse.json({
      success: true,
      hasRegistration,
      ...data,
      busRouteId,
      qrCode,
      pageCsrf,
    });
  } catch (error: any) {
    console.error("Transport fetch error:", error);
    return NextResponse.json(
      { hasRegistration: false, error: error.message || "Failed to fetch transport data" },
      { status: 200 }
    );
  }
}
