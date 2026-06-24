import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import * as cheerio from "cheerio";
import { URLSearchParams } from "url";

/**
 * @openapi
 * /api/student:
 *   post:
 *     tags:
 *       - Student
 *     summary: POST endpoint for /api/student
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
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

export async function POST(req: Request) {
    try {
        const { cookies, authorizedID, csrf } = await req.json().catch(() => ({}));

        const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
        if (!csrf || !authorizedID) {
            throw new Error("Cannot find _csrf or authorizedID");
        }

        const client = VTOPClient();

        const profileRes = await client.post(
            "/vtop/studentsRecord/StudentProfileAllView",
            new URLSearchParams({
                verifyMenu: "true",
                authorizedID,
                _csrf: csrf,
                nocache: Date.now().toString(),
            }).toString(),
            {
                headers: {
                    Cookie: cookieHeader,
                    "Content-Type": "application/x-www-form-urlencoded",
                    Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
                },
            }
        );

        const $ = cheerio.load(profileRes.data);
        let profile: any = {};

        $("table tr").each((_, row) => {
            const cols = $(row).find("td");
            if (cols.length < 2) return;

            const label = cols.eq(0).text().trim();
            const value = cols.eq(1).text().trim();

            if (label.includes("Application Number")) profile.applicationNumber = value;
            else if (label.includes("Student Name")) profile.name = value;
            else if (label.includes("Date of Birth")) profile.dob = value;
            else if (label.includes("Blood Group")) profile.bloodGroup = value;
            else if (label.includes("Program / Branch")) profile.branch = value;
            else if (label.includes("GENDER")) profile.gender = value;
            else if (label.includes("HOSTELLER")) profile.isHosteller = value === "HOSTELLER";
        });

        const imgMatch = profileRes.data.match(/src="(data:[^"]+base64,[^"]+)"/i) || profileRes.data.match(/src="(data:image[^"]+)"/i);
        if (imgMatch) {
            profile.image = imgMatch[1];
        }

        return NextResponse.json({ profile }, { status: 200 });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
