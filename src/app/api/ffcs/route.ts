import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import * as cheerio from "cheerio";
import { URLSearchParams } from "url";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";
import { parseFeedbackStatus } from "@/lib/parsers/feedback-status";
import { publicErrorMessage } from "@/lib/publicError";

const REFERER = "https://vtopcc.vit.ac.in/vtop/open/page";

function cookieHeaderOf(cookies: unknown): string {
  return Array.isArray(cookies) ? cookies.join("; ") : String(cookies ?? "");
}

/**
 * Combined FFCS-related endpoint.
 * - registrationSchedule: registration schedule view (previously /api/registration-schedule)
 * - feedbackStatus: detailed feedback status (previously /api/feedback-status)
 * - feedback: simple standalone Mid/End feedback completion status (moved from /api/grades)
 *
 * For feedback details of a specific semester, pass `semesterId`.
 * Use `section: "registration" | "feedback"` to fetch only one part.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { cookies, authorizedID, csrf, semesterId, section } = body as {
      cookies?: string | string[];
      authorizedID?: string;
      csrf?: string;
      semesterId?: string;
      section?: "registration" | "feedback" | "all";
    };

    const cookieHeader = cookieHeaderOf(cookies);
    if (!csrf || !authorizedID) {
      return NextResponse.json({ success: false, error: "Missing csrf or authorizedID" }, { status: 400 });
    }

    const client = VTOPClient();
    const wantRegistration = !section || section === "all" || section === "registration";
    const wantFeedback = !section || section === "all" || section === "feedback";

    let registrationSchedule: unknown = undefined;
    let feedbackStatus: unknown = undefined;
    let feedback: unknown = undefined;

    if (wantRegistration) {
      const resp = await client.post(
        "/vtop/examinations/hostelDetails",
        new URLSearchParams({
          verifyMenu: "true",
          authorizedID: String(authorizedID),
          _csrf: String(csrf),
          nocache: Date.now().toString(),
        }).toString(),
        {
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/x-www-form-urlencoded",
            Referer: REFERER,
          },
        }
      );
      registrationSchedule = { success: true, ...parseVtopHtml(resp.data) };
    }

    if (wantFeedback) {
      // Detailed feedback status (table/semesters)
      if (semesterId) {
        const resp = await client.post(
          "/vtop/processViewFeedBackStatus",
          new URLSearchParams({
            authorizedID: String(authorizedID),
            semesterSubId: String(semesterId),
            _csrf: String(csrf),
            x: new Date().toUTCString(),
          }).toString(),
          {
            headers: {
              Cookie: cookieHeader,
              "Content-Type": "application/x-www-form-urlencoded",
              Referer: REFERER,
            },
          }
        );
        const semesterData = parseFeedbackStatus(resp.data);
        feedbackStatus = { success: true, semesterId, ...semesterData };
      } else {
        const resp = await client.post(
          "/vtop/academics/common/FeedBackStatusStudent",
          new URLSearchParams({
            verifyMenu: "true",
            authorizedID: String(authorizedID),
            _csrf: String(csrf),
            nocache: Date.now().toString(),
          }).toString(),
          {
            headers: {
              Cookie: cookieHeader,
              "Content-Type": "application/x-www-form-urlencoded",
              Referer: REFERER,
            },
          }
        );
        feedbackStatus = { success: true, ...parseFeedbackStatus(resp.data) };
      }

      // Simple standalone feedback status (moved from /api/grades)
      const simpleResp = await client.post(
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
            Referer: REFERER,
          },
        }
      );
      const $$$ = cheerio.load(simpleResp.data);
      const isGiven = (text: string) => !text.toLowerCase().includes("not");
      feedback = {
        MidSem: {
          Curriculum: isGiven($$$("tbody tr").eq(0).find("td").eq(1).text()),
          Course: isGiven($$$("tbody tr").eq(1).find("td").eq(1).text()),
        },
        EndSem: {
          Curriculum: isGiven($$$("tbody tr").eq(0).find("td").eq(2).text()),
          Course: isGiven($$$("tbody tr").eq(1).find("td").eq(2).text()),
        },
      };
    }

    return NextResponse.json({ success: true, registrationSchedule, feedbackStatus, feedback });
  } catch (err: unknown) {
    console.error("ffcs error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ success: false, error: publicErrorMessage(err) }, { status: 500 });
  }
}
