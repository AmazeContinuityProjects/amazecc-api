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
    if (semesterId) {
      const resp = await client.post(
        "/vtop/compre/getStudentRegisteredExam",
        new URLSearchParams({
          authorizedID: String(authorizedID),
          semesterSubId: semesterId,
          _csrf: String(csrf),
          x: new Date().toUTCString(),
        }).toString(),
        {
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/x-www-form-urlencoded",
            Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
          },
        }
      );
      return NextResponse.json({ success: true, semesterId, ...parseVtopHtml(resp.data) });
    }
    const resp = await client.post(
      "/vtop/compre/onlineExamStudentAttemptView",
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
    console.error("online-exam-attempt error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
