import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import { parseStudentProfile } from "@/lib/parsers/student-profile";
import { parseProctor } from "@/lib/parsers/proctor";
import { parseHodDean } from "@/lib/parsers/hod-dean";
import { parseCredentials } from "@/lib/parsers/credentials";
import { parseBankInfo } from "@/lib/parsers/bank-info";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";
import { buildIdentity } from "@/lib/identity";

/**
 * @openapi
 * /api/me:
 *   post:
 *     tags:
 *       - Student
 *     summary: Consolidated student identity (student + proctor + HoD/Dean + credentials + APAAR + bank) in one call
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cookies:
 *                 type: string
 *               authorizedID:
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
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 */

const BASE_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
} as const;

function formParams(authorizedID: string, csrf: string): string {
  return new URLSearchParams({
    verifyMenu: "true",
    authorizedID,
    _csrf: csrf,
    nocache: Date.now().toString(),
  }).toString();
}

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ success: false, error: "Missing csrf or authorizedID" }, { status: 400 });
    }

    const client = VTOPClient();
    const headers = { ...BASE_HEADERS, Cookie: cookieHeader };

    const [studentRes, proctorRes, hodDeanRes, credsRes, apaarRes, bankRes] = await Promise.all([
      client.post("/vtop/studentsRecord/StudentProfileAllView", formParams(authorizedID, csrf), { headers }),
      client.post("/vtop/proctor/viewProctorDetails", formParams(authorizedID, csrf), { headers }),
      client.post("/vtop/hrms/viewHodDeanDetails", formParams(authorizedID, csrf), { headers }),
      client.post("/vtop/proctor/viewStudentCredentials", formParams(authorizedID, csrf), { headers }),
      client.post("/vtop/apaarid/upload", formParams(authorizedID, csrf), { headers }),
      client.post("/vtop/studentBankInformation/BankInfoStudent", formParams(authorizedID, csrf), { headers }),
    ]);

    const student = parseStudentProfile(studentRes.data);
    const proctor = parseProctor(proctorRes.data);
    const hodDean = parseHodDean(hodDeanRes.data);
    const credentials = parseCredentials(credsRes.data);
    const apaarParsed = parseVtopHtml(apaarRes.data);
    const hasApaar =
      (apaarParsed.keyValuePairs && Object.keys(apaarParsed.keyValuePairs).length > 0) ||
      (apaarParsed.tables && apaarParsed.tables.some((t) => t.rows.length > 0)) ||
      Object.values(apaarParsed.formFields || {}).some(
        (v) => v && v.length > 4 && v !== "-" && !v.startsWith("0")
      ) ||
      /\.pdf/i.test(apaarRes.data) ||
      /already uploaded|submitted successfully/i.test(apaarRes.data);
    const bank = parseBankInfo(bankRes.data);

    const identity = buildIdentity({ student, proctor, hodDean, credentials, apaar: apaarParsed, hasApaar, bank });

    return NextResponse.json({ success: true, identity });
  } catch (err: any) {
    console.error("me error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}