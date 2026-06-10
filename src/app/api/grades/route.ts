import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import * as cheerio from "cheerio";
import { URLSearchParams } from "url";
import { CGPA, CurriculumItem, EffectiveGrade, FeedbackStatus } from "@/types/data/grades";
import { RequestBody } from "@/types/custom";






/**
 * @openapi
 * /api/grades:
 *   post:
 *     tags:
 *       - Grades
 *     summary: POST endpoint for /api/grades
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

        if (!csrf || !authorizedID) {
            throw new Error("Cannot find _csrf or authorizedID");
        }

        const client = VTOPClient();

        const gradeRes = await client.post(
            "/vtop/examinations/examGradeView/StudentGradeHistory",
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

        const $$ = cheerio.load(gradeRes.data);
        const effectiveGrades: EffectiveGrade[] = [];

        $$("#fixedTableContainer table")
            .eq(1)
            .find("tr.tableContent")
            .each((_, el) => {
                const tds = $$(el).find("td");
                effectiveGrades.push({
                    basketTitle: $$(tds[2]).text().trim(),
                    courseType: $$(tds[3]).text().trim(),
                    creditsEarned: $$(tds[4]).text().trim(),
                    grade: $$(tds[5]).text().trim(),
                    distributionType: $$(tds[8]).text().trim(),
                });
            });

        const curriculum: CurriculumItem[] = [];

        $$("#fixedTableContainer table")
            .eq(5)
            .find("tr.tableContent")
            .each((_, el) => {
                const tds = $$(el).find("td");
                curriculum.push({
                    basketTitle: $$(tds[0]).text().trim(),
                    creditsRequired: $$(tds[1]).text().trim(),
                    creditsEarned: $$(tds[2]).text().trim(),
                });
            });

        $$("#fixedTableContainer table")
            .eq(6)
            .find("tr.tableContent")
            .each((_, el) => {
                const tds = $$(el).find("td");
                curriculum.push({
                    basketTitle: $$(tds[0]).text().trim(),
                    creditsRequired: $$(tds[2]).text().trim(),
                    creditsEarned: $$(tds[3]).text().trim(),
                });
            });
        
        const cgpa: CGPA = {};
        const cgpaRow = $$("table.table.table-hover.table-bordered tbody tr").first();

        if (cgpaRow.length) {
            const tds = cgpaRow.find("td");
            cgpa.grades = {
                S: parseInt($$(tds[3]).text().trim()),
                A: parseInt($$(tds[4]).text().trim()),
                B: parseInt($$(tds[5]).text().trim()),
                C: parseInt($$(tds[6]).text().trim()),
                D: parseInt($$(tds[7]).text().trim()),
                E: parseInt($$(tds[8]).text().trim()),
                F: parseInt($$(tds[9]).text().trim()),
                N: parseInt($$(tds[10]).text().trim()),
            };
        }

        const feedbackRes = await client.post(
            "/vtop/processViewFeedBackStatus",
            new URLSearchParams({
                authorizedID: String(authorizedID),
                semesterSubId: semesterId ?? "",
                _csrf: String(csrf),
                x: Date.now().toString(),
            }).toString(),
            {
                headers: {
                    Cookie: cookieHeader,
                    "Content-Type": "application/x-www-form-urlencoded",
                    Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
                },
            }
        );

        const $$$ = cheerio.load(feedbackRes.data);
        const isGiven = (text: string) => !text.toLowerCase().includes("not");

        const feedback: FeedbackStatus = {
            MidSem: {
                Curriculum: isGiven($$$("tbody tr").eq(0).find("td").eq(1).text()),
                Course: isGiven($$$("tbody tr").eq(1).find("td").eq(1).text()),
            },
            EndSem: {
                Curriculum: isGiven($$$("tbody tr").eq(0).find("td").eq(2).text()),
                Course: isGiven($$$("tbody tr").eq(1).find("td").eq(2).text()),
            },
        };

        return NextResponse.json({
            effectiveGrades,
            curriculum,
            cgpa,
            feedback,
        }, { status: 200 });

    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}


