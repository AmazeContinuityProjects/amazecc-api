import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import { parseCurriculum } from "@/lib/parsers/curriculum";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ error: "Missing csrf or authorizedID" }, { status: 400 });
    }
    const client = VTOPClient();
    const resp = await client.post(
      "/vtop/academics/common/Curriculum",
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
    const data = parseCurriculum(resp.data);
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error("curriculum error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
