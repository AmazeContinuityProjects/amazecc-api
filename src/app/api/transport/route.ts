/**
 * @openapi
 * /api/transport:
 *   post:
 *     tags:
 *       - Transport
 *     summary: The student's transport registration plus the live bus tracking link.
 *     description: >
 *       A single VTOP proxy that returns everything transport-related for the
 *       signed-in student: the parsed transport registration page and, when a
 *       bus route is registered, the `busUrl` returned by
 *       `/vtop/transport/trackMyBus`. Batching the two VTOP calls into one
 *       endpoint keeps "Track my bus" from costing a second function invocation.
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
 *                 hasRegistration: true
 *                 busRouteId: "1316"
 *                 busUrl: "https://gpsvtspro.vamosys.com/shareLinkForMultipleVehicles/..."
 *                 qrCode: "data:image/jpg;base64,..."
 *                 pageCsrf: "sample_value"
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
import * as cheerio from "cheerio";
import { URLSearchParams } from "url";

/**
 * Ask VTOP for the live GPS share link for a registered route.
 *
 * Returns `""` on any failure so a tracking-link outage can never take down the
 * whole transport response (the registration page is the primary payload).
 */
async function fetchBusUrl(
  client: ReturnType<typeof VTOPClient>,
  cookieHeader: string | undefined,
  authorizedID: string,
  csrf: string,
  busRouteId: string
): Promise<string> {
  try {
    const resp = await client.post(
      "/vtop/transport/trackMyBus",
      new URLSearchParams({
        authorizedID: String(authorizedID),
        _csrf: String(csrf),
        busRouteId: String(busRouteId),
        x: Date.now().toString(),
      }).toString(),
      {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/x-www-form-urlencoded",
          // VTOPClient defaults to `Accept: text/html,application/xhtml+xml`, which
          // makes VTOP answer this endpoint with an HTML "Unidentified OS or Browser"
          // error page instead of the JSON payload. Force JSON here.
          Accept: "application/json",
        },
      }
    );

    const raw = resp.data;
    if (typeof raw === "string" && /^\s*<!doctype html/i.test(raw)) return "";
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed?.busUrl || "";
  } catch (err) {
    console.error("Bus tracking link unavailable:", err);
    return "";
  }
}

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

    // Same session, so the tracking link rides along with the registration fetch.
    // Uses the page's own csrf (falls back to the login csrf) like the VTOP page does.
    const busUrl = busRouteId
      ? await fetchBusUrl(client, cookieHeader, String(authorizedID), pageCsrf, busRouteId)
      : "";

    return NextResponse.json({
      success: true,
      hasRegistration,
      ...data,
      busRouteId,
      busUrl,
      qrCode,
      pageCsrf,
    });
  } catch (error: unknown) {
    console.error("Transport fetch error:", error);
    return NextResponse.json(
      { hasRegistration: false, error: (error instanceof Error ? error.message : String(error)) || "Failed to fetch transport data" },
      { status: 200 }
    );
  }
}
