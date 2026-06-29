/**
 * @openapi
 * /api/change-password:
 *   post:
 *     tags:
 *       - Change Password
 *     summary: Auto-generated POST endpoint for /api/change-password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               csrf:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               authorizedID:
 *                 type: string
 *               oldPassword:
 *                 type: string
 *               cookies:
 *                 type: string
 *               confirmNewPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 submitData: "sample_value"
 *                 success: true
 *                 data: "sample_value"
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import { parseChangePassword } from "@/lib/parsers/change-password";

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
      const submitData = parseChangePassword(submitResp.data);
      return NextResponse.json({ success: true, ...submitData });
    }

    const resp = await client.post(
      "/vtop/controlpanel/ChangePassword",
      new URLSearchParams({
        verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
      }).toString(),
      { headers }
    );
    const data = parseChangePassword(resp.data);
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error("change-password error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
