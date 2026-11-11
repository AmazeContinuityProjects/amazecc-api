import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import * as cheerio from "cheerio";
import { URLSearchParams } from "url";
import { CGPA, CurriculumItem, EffectiveGrade, FeedbackStatus } from "@/types/data/grades";
import { fetchAllGradesHistory } from "@/lib/grades/fetchAllGradesHistory";

/**
 * Unified grades endpoint.
 *
 * Returns the summary previously served by /api/grades plus the semester-wise
 * detailed history previously served by /api/all-grades under `history`.
 */
export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf, semesterId } = await req.json().catch(() => ({}));

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
      const cell = (i: number) => $$(tds[i]).text().trim();

      const creditsRegistered = cell(0);
      const creditsEarned = cell(1);
      const published = cell(2);

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

    const history = await fetchAllGradesHistory({
      cookieHeader,
      authorizedID: String(authorizedID),
      csrf: String(csrf),
      client,
    });

    return NextResponse.json(
      {
        success: true,
        overall: {
          effectiveGrades,
          curriculum,
          cgpa,
          feedback,
        },
        semesters: history,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
