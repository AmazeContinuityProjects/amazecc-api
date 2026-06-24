import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf, oldPassword, newPassword, confirmNewPassword } = await req.json().catch(() => ({}));
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

    if (oldPassword && newPassword && confirmNewPassword) {
      const submitResp = await client.post(
        "/vtop/controlpanel/UpdatePassword",
        new URLSearchParams({
          authorizedID, _csrf: csrf,
          oldPassword, newPassword, confirmNewPassword,
          x: new Date().toUTCString(),
        }).toString(),
        { headers }
      );
      return NextResponse.json({ success: true, ...parseVtopHtml(submitResp.data) });
    }

    const resp = await client.post(
      "/vtop/controlpanel/ChangePassword",
      new URLSearchParams({
        verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
      }).toString(),
      { headers }
    );
    return NextResponse.json({ success: true, ...parseVtopHtml(resp.data) });
  } catch (err: any) {
    console.error("change-password error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
