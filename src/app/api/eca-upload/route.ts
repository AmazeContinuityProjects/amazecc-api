import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";

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

    if (semesterId) {
      const dataResp = await client.post(
        "/vtop/examinations/ecaUpload/doViewECACourses",
        new URLSearchParams({
          authorizedID, x: new Date().toUTCString(),
          semesterSubId: semesterId, _csrf: csrf,
        }).toString(),
        { headers }
      );
      return NextResponse.json({ success: true, semesterId, ...parseVtopHtml(dataResp.data) });
    }

    const pageResp = await client.post(
      "/vtop/examinations/ecaUpload/viewCourse",
      new URLSearchParams({
        verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
      }).toString(),
      { headers }
    );
    return NextResponse.json({ success: true, ...parseVtopHtml(pageResp.data) });
  } catch (err: any) {
    console.error("eca-upload error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
