import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import * as cheerio from "cheerio";
import { URLSearchParams } from "url";
import { ExamItem, Schedule } from "@/types/data/schedule";





/**
 * @openapi
 * /api/schedule:
 *   post:
 *     tags:
 *       - Schedule
 *     summary: POST endpoint for /api/schedule
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
 *               semesterId:
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
        const {  cookies, authorizedID, csrf, semesterId  } = await req.json().catch(()=>({}));

        const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
        if (!csrf || !authorizedID)
            throw new Error("Cannot find _csrf or authorizedID");

        const client = VTOPClient();
        const ScheduleRes = await client.post(
            "/vtop/examinations/doSearchExamScheduleForStudent",
            new URLSearchParams({
                authorizedID: String(authorizedID),
                semesterSubId: semesterId ?? "",
                _csrf: String(csrf)
            }).toString(),
            {
                headers: {
                    Cookie: cookieHeader,
                    "Content-Type": "application/x-www-form-urlencoded",
                    Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
                },
            }
        );

        const $$$ = cheerio.load(ScheduleRes.data);
        const Schedule: Schedule = {};
        let currentExamType: string | null = null;

        $$$("table.customTable tr").each((i, row) => {
            const tds = $$$(row).find("td");

            if (tds.length === 1 && $$$(tds[0]).attr("colspan") === "13") {
                currentExamType = $$$(tds[0]).text().trim();
                return;
            }

            if ($$$(row).hasClass("tableHeader")) return;
            if(!currentExamType) return;

            if ($$$(row).hasClass("tableContent") && tds.length > 1) {
                const item: ExamItem = {
                    courseCode: $$$(tds[1]).text().trim(),
                    courseTitle: $$$(tds[2]).text().trim(),
                    classId: $$$(tds[4]).text().trim(),
                    slot: $$$(tds[5]).text().trim(),
                    examDate: $$$(tds[6]).text().trim(),
                    examSession: $$$(tds[7]).text().trim(),
                    reportingTime: $$$(tds[8]).text().trim(),
                    examTime: $$$(tds[9]).text().trim(),
                    venue: $$$(tds[10]).text().trim(),
                    seatLocation: $$$(tds[11]).text().trim(),
                    seatNo: $$$(tds[12]).text().trim(),
                };

                if (!Schedule[currentExamType]) {
                    Schedule[currentExamType] = [];
                }
                (Schedule[currentExamType] as ExamItem[]).push(item);
            }
        });

        return NextResponse.json({
            semester: semesterId,
            Schedule: Schedule
        }, { status: 200 });
    } catch (err: unknown) {
        console.error(err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}


