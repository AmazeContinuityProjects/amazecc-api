import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import * as cheerio from "cheerio";
import { URLSearchParams } from "url";
import { CGPA, CurriculumItem, EffectiveGrade, FeedbackStatus } from "@/types/data/grades";






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

        // VTOP nests an embedded course's theory/lab breakdown as sub-tables
        // inside this one, and each of those sub-tables repeats its own header
        // row as `tr.tableContent`. Those headers are not courses. Unfiltered,
        // they arrive as eight rows whose `creditsEarned` is the literal string
        // "Credits" and whose `grade` is "Grade" — which is worse than dropping
        // them, because a consumer summing credits treats "Credits" as NaN at
        // best and as a row at worst.
        //
        // A real course has a numeric credit value AND a letter on the 10-point
        // scale. Verified against a real capture (14 real rows, 8 headers) that
        // the two conditions select an identical set, so requiring both is
        // belt-and-braces rather than a judgement call between them.
        const CREDITS_NUMERIC = /^\d+(?:\.\d+)?$/;
        const GRADE_LETTER = /^[SABCDEF]$/i;

        $$("#fixedTableContainer table")
            .eq(1)
            .find("tr.tableContent")
            .each((_, el) => {
                const tds = $$(el).find("td");
                const credits = $$(tds[4]).text().trim();
                const grade = $$(tds[5]).text().trim();
                if (!CREDITS_NUMERIC.test(credits) || !GRADE_LETTER.test(grade)) return;

                effectiveGrades.push({
                    basketTitle: $$(tds[2]).text().trim(),
                    courseType: $$(tds[3]).text().trim(),
                    creditsEarned: credits,
                    grade,
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
            // Cells 0-2 are Credits Registered, Credits Earned and CGPA. The
            // parser used to read only 3-10, throwing away the figure it had
            // just downloaded — so `/api/grades` served a grade *distribution*
            // and no CGPA at all, leaving the app to source its only CGPA from
            // the unrelated `marks` route.
            const cell = (i: number) => $$(tds[i]).text().trim();

            const creditsRegistered = cell(0);
            const creditsEarned = cell(1);
            const published = cell(2);

            // Kept as the strings VTOP sends, like every other figure here. The
            // app decides what counts as a usable number; a parser that quietly
            // turned "" into 0 would make "VTOP said nothing" indistinguishable
            // from "VTOP said zero", and those mean opposite things for CGPA.
            if (CREDITS_NUMERIC.test(creditsRegistered)) cgpa.creditsRegistered = creditsRegistered;
            if (CREDITS_NUMERIC.test(creditsEarned)) cgpa.creditsEarned = creditsEarned;
            if (CREDITS_NUMERIC.test(published)) cgpa.cgpa = published;

            cgpa.grades = {
                S: parseInt(cell(3)),
                A: parseInt(cell(4)),
                B: parseInt(cell(5)),
                C: parseInt(cell(6)),
                D: parseInt(cell(7)),
                E: parseInt(cell(8)),
                F: parseInt(cell(9)),
                N: parseInt(cell(10)),
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

    } catch (err: unknown) {
        console.error(err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}


