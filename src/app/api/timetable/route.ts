import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import fetchTimetable from "@/lib/fetchTimeTable";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf, semesterId } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });
    }

    if (semesterId) {
      const courseInfo = await fetchTimetable(cookieHeader, authorizedID, csrf, semesterId);
      return NextResponse.json({ success: true, semesterId, courseInfo });
    }

    const client = VTOPClient();
    const resp = await client.post(
      "/vtop/academics/common/StudentTimeTableChn",
      new URLSearchParams({
        verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
      }).toString(),
      {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
        },
      }
    );
    return NextResponse.json({ success: true, ...parseVtopHtml(resp.data) });
  } catch (err: any) {
    console.error("timetable error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
