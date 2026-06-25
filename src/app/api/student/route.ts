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

        const parseAddress = (html: string): Record<string, string> => {
            const addr: Record<string, string> = {};
            const parts = html.split(/<br\s*\/?>/i);
            for (const part of parts) {
                const cleaned = $(`<div>${part}</div>`).text().trim();
                if (!cleaned) continue;
                const colonIdx = cleaned.indexOf(":");
                if (colonIdx > 0) {
                    const key = cleaned.slice(0, colonIdx).trim().toLowerCase().replace(/\s+/g, "");
                    const val = cleaned.slice(colonIdx + 1).trim();
                    if (val) addr[key] = val;
                }
            }
            return addr;
        };

        $("table tr").each((_, row) => {
            const cols = $(row).find("td");
            if (cols.length < 2) return;

            const label = cols.eq(0).text().trim();
            const value = cols.eq(1).text().trim();
            const valueHtml = $(cols[1]).html() || "";

            const L = label.toUpperCase();

            if (L.includes("APPLICATION NUMBER")) profile.applicationNumber = value;
            else if (L.includes("STUDENT NAME")) profile.name = value;
            else if (L.includes("DATE OF BIRTH")) profile.dob = value;
            else if (L.includes("BLOOD GROUP")) profile.bloodGroup = value;
            else if (L.includes("PROGRAM / BRANCH") || L.includes("BRANCH")) profile.branch = value;
            else if (L.includes("GENDER")) profile.gender = value;
            else if (L.includes("HOSTEL")) profile.isHosteller = value.toUpperCase() === "HOSTELLER" || value.toUpperCase() === "YES";
            else if (L.includes("NATIVE LANGUAGE")) profile.nativeLanguage = value;
            else if (L.includes("NATIVE STATE")) profile.nativeState = value;
            else if (L.includes("PHYSICALLY CHALLENGED")) profile.physicallyChallenged = value;
            else if (L.includes("COMMUNITY")) profile.community = value;
            else if (L.includes("RELIGION")) profile.religion = value;
            else if (L.includes("CASTE")) profile.caste = value;
            else if (L.includes("NATIONALITY")) profile.nationality = value;
            else if (L.includes("AADHAR") || L.includes("AADHAAR")) profile.aadharNumber = value;
            else if (L.includes("MOBILE NUMBER")) profile.mobileNumber = value;
            else if (L.includes("FRIEND MOBILE")) profile.friendMobileNumber = value;
            else if (L.includes("CURRENT ADDRESS")) profile.currentAddress = parseAddress(valueHtml);
            else if (L.includes("PERMANENT ADDRESS")) profile.permanentAddress = parseAddress(valueHtml);
            else if (L.includes("APPLIED DEGREE")) profile.appliedDegree = value;
            else if (L.includes("EDUCATIONAL QUALIFICATION")) profile.educationalQualification = value;
            else if (L.includes("BRANCH / GROUP STUDIED")) profile.branchStudied = value;
            else if (L.includes("SCHOOL NAME") || L.includes("SCHOOL/COLLEGE NAME")) profile.schoolName = value;
            else if (L.includes("MEDIUM OF STUDY")) profile.mediumOfStudy = value;
            else if (L.includes("BOARD / UNIVERSITY")) profile.boardUniversity = value;
            else if (L.includes("REGISTER NO")) profile.registerNo = value;
            else if (L.includes("CLASS OBTAINED")) profile.classObtained = value;
            else if (L.includes("YEAR OF PASSING") || L.includes("YEAR OF PASSED")) profile.yearOfPassing = value;
            else if (L.includes("MONTH OF PASSING") || L.includes("MONTH OF PASSED")) profile.monthOfPassing = value;
            else if (L.includes("SCHOOL / COLLEGE ADDRESS") || L.includes("SCHOOL ADDRESS")) profile.schoolAddress = value;
            else if (L.includes("BREAK IN STUDY")) profile.breakInStudy = value;
            else if (L.includes("NO.OF.BROTHERS") || L.includes("NO.OF BROTHERS")) profile.brothers = value;
            else if (L.includes("NO.OF.SISTERS") || L.includes("NO.OF SISTERS")) profile.sisters = value;
            else if (L.includes("BROTHER/SISTER STUDYING") || L.includes("SIBLING")) profile.siblingInVIT = value;
            else if (L.includes("FATHER NAME")) { profile.father ??= {}; profile.father.name = value; }
            else if (L.includes("FATHER QUALIFICATION")) { profile.father ??= {}; profile.father.qualification = value; }
            else if (L.includes("FATHER OCCUPATION")) { profile.father ??= {}; profile.father.occupation = value; }
            else if (L.includes("FATHER ORGANISATION") || L.includes("FATHER ORGANIZATION")) { profile.father ??= {}; profile.father.organization = value; }
            else if (L.includes("FATHER MOBILE")) { profile.father ??= {}; profile.father.mobile = value; }
            else if (L.includes("FATHER EMAIL")) { profile.father ??= {}; profile.father.email = value; }
            else if (L.includes("FATHER ANNUAL INCOME")) { profile.father ??= {}; profile.father.annualIncome = value; }
            else if (L.includes("FATHER DESIGNATION")) { profile.father ??= {}; profile.father.designation = value; }
            else if (L.includes("FATHER ADDRESS")) { profile.father ??= {}; profile.father.address = value; }
            else if (L.includes("MOTHER NAME")) { profile.mother ??= {}; profile.mother.name = value; }
            else if (L.includes("MOTHER QUALIFICATION")) { profile.mother ??= {}; profile.mother.qualification = value; }
            else if (L.includes("MOTHER OCCUPATION")) { profile.mother ??= {}; profile.mother.occupation = value; }
            else if (L.includes("MOTHER ORGANISATION") || L.includes("MOTHER ORGANIZATION")) { profile.mother ??= {}; profile.mother.organization = value; }
            else if (L.includes("MOTHER MOBILE")) { profile.mother ??= {}; profile.mother.mobile = value; }
            else if (L.includes("MOTHER EMAIL")) { profile.mother ??= {}; profile.mother.email = value; }
            else if (L.includes("MOTHER ANNUAL INCOME")) { profile.mother ??= {}; profile.mother.annualIncome = value; }
            else if (L.includes("MOTHER DESIGNATION")) { profile.mother ??= {}; profile.mother.designation = value; }
            else if (L.includes("MOTHER ADDRESS")) { profile.mother ??= {}; profile.mother.address = value; }
            else if (L.includes("GUARDIAN")) profile.guardian = value;
            else if (L.includes("FACULTY ID")) { profile.proctor ??= {}; profile.proctor.facultyId = value; }
            else if (L.includes("FACULTY NAME")) { profile.proctor ??= {}; profile.proctor.name = value; }
            else if (L.includes("FACULTY DESIGNATION")) { profile.proctor ??= {}; profile.proctor.designation = value; }
            else if (L.includes("FACULTY SCHOOL") || L.includes("SCHOOL")) { profile.proctor ??= {}; profile.proctor.school = value; }
            else if (L.includes("CABIN")) { profile.proctor ??= {}; profile.proctor.cabin = value; }
            else if (L.includes("FACULTY DEPARTMENT")) { profile.proctor ??= {}; profile.proctor.department = value; }
            else if (L.includes("FACULTY EMAIL")) { profile.proctor ??= {}; profile.proctor.email = value; }
            else if (L.includes("INTERCOM")) { profile.proctor ??= {}; profile.proctor.intercom = value; }
            else if (L.includes("FACULTY MOBILE") || L.includes("FACULTY PHONE")) { profile.proctor ??= {}; profile.proctor.mobile = value; }
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
