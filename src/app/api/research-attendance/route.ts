import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf, fromDate, toDate, year, month } = await req.json().catch(() => ({}));
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

    if (fromDate || toDate || year || month) {
      const dataResp = await client.post(
        "/vtop/research/scholarsAttendanceViewProcess",
        new URLSearchParams({
          authorizedID, x: new Date().toUTCString(),
          fromDate: fromDate || "", toDate: toDate || "",
          year: year || "", month: month || "", _csrf: csrf,
        }).toString(),
        { headers }
      );
      return NextResponse.json({ success: true, ...parseVtopHtml(dataResp.data) });
    }

    const resp = await client.post(
      "/vtop/research/scholarsAttendanceView",
      new URLSearchParams({
        verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
      }).toString(),
      { headers }
    );
    return NextResponse.json({ success: true, ...parseVtopHtml(resp.data) });
  } catch (err: any) {
    console.error("research-attendance error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
