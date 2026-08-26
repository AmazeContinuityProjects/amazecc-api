/**
 * @openapi
 * /api/profile-images:
 *   post:
 *     tags:
 *       - Profile Images
 *     summary: Auto-generated POST endpoint for /api/profile-images
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
 *                 hodDean: "sample_value"
 *                 success: true
 *                 proctor: "sample_value"
 *                 credentials: "sample_value"
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
import { parseProctor } from "@/lib/parsers/proctor";
import { parseHodDean } from "@/lib/parsers/hod-dean";
import { parseCredentials } from "@/lib/parsers/credentials";

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf } = await req.json().catch(() => ({}));
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

    const [proctorRes, hodDeanRes, credsRes] = await Promise.all([
      client.post("/vtop/proctor/viewProctorDetails", new URLSearchParams({ verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString() }).toString(), { headers }),
      client.post("/vtop/hrms/viewHodDeanDetails", new URLSearchParams({ verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString() }).toString(), { headers }),
      client.post("/vtop/proctor/viewStudentCredentials", new URLSearchParams({ verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString() }).toString(), { headers }),
    ]);

    const proctor = parseProctor(proctorRes.data);
    const hodDean = parseHodDean(hodDeanRes.data);
    const credentials = parseCredentials(credsRes.data);

    return NextResponse.json({
      success: true,
      proctor,
      hodDean,
      credentials,
    });
  } catch (err: unknown) {
    console.error("profile-images error:", (err instanceof Error ? err.message : String(err)));
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
