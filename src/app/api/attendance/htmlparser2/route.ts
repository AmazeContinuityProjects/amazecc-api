import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { parseDocument } from "htmlparser2";
import { selectAll } from "css-select";
import { textContent, getAttributeValue } from "domutils";
import type { AnyNode, Element } from "domhandler";
import { URLSearchParams } from "url";
import fetchTimetable from "@/lib/fetchTimeTable.htmlparser2";
import { attendanceItem, courseItem } from "@/types/data/attendance";

import { getMarks } from "@/lib/marks.htmlparser2";
import { parseStudentProfile } from "@/lib/parsers/student-profile.htmlparser2";
import {
    ensureSchema,
    ownerKeyFor,
    recordEnrollment,
} from "@/lib/marksStats";

async function batchAll<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function textOf(node: AnyNode | undefined | null): string {
    return node ? textContent(node).replace(/\r\n/g, "\n").trim() : "";
}

function getCells(row: AnyNode): Element[] {
    return selectAll("td", row) as Element[];
}

function mergeAttendanceWithTimetable(attendance: attendanceItem[], timetable: courseItem[]): attendanceItem[] {
    const merged: attendanceItem[] = [];

    timetable.forEach(tt => {
        const ttCourseCode = tt.courseCode.trim();
        const attEntry = attendance.find(att =>
            (att?.courseCode?.split(" ")[0] ?? "").trim() === ttCourseCode
        );

        const cleanedVenue = tt.slotVenue
            ? (() => {
                const cleaned = tt.slotVenue.replace(/\s+/g, " ").trim();
                const matches = cleaned.match(/[A-Z]+\d*\s*-\s*\d+\s*[A-Z]?/g);
                return matches ? matches[matches.length - 1] : null;
            })()
            : null;

        if (attEntry) {
            merged.push({
                ...attEntry,
                classId: tt.classId,
                credits: tt.LTPJC?.split(" ")[4] || null,
                slotVenue: cleanedVenue,
                category: tt.category || null,
            });
        } else {
            merged.push({
                slNo: null,
                courseCode: tt.courseCode,
                courseTitle: tt.course,
                courseType: null,
                slotName: "NILL",
                faculty: tt.facultyDetails || null,
                registrationDate: null,
                attendanceDate: null,
                attendedClasses: null,
                totalClasses: null,
                attendancePercentage: null,
                viewLink: null,
                classId: tt.classId,
                credits: tt.LTPJC?.split(" ")[4] || null,
                slotVenue: cleanedVenue,
                category: tt.category || null,
            });
        }
    });
    return merged;
}

/**
 * Backup/experimental attendance route fully swapped to htmlparser2 + css-select/domutils
 * for HTML parsing: inline attendance/detail parsing plus timetable, marks, and student
 * profile parsing (via *.htmlparser2 helpers). Original /api/attendance remains unchanged.
 */
export async function POST(req: Request) {
    try {
        const { cookies, authorizedID, csrf, semesterId } = await req.json().catch(() => ({}));

        const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;

        if (!csrf || !authorizedID)
            throw new Error("Cannot find _csrf or authorizedID");

        const client = VTOPClient();

        const ttRes = await client.post(
            "/vtop/processViewStudentAttendance",
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

        const courseInfo: courseItem[] = await fetchTimetable(
            cookieHeader,
            authorizedID,
            csrf,
            (semesterId as string)
        );
        const courseCreditMap: Record<string, number> = {};
        courseInfo.forEach(course => {
            courseCreditMap[course.courseCode.trim()] = parseFloat(course.LTPJC?.split(" ")[4] || "0");
        });

        const marksRes = await getMarks(
            cookieHeader,
            authorizedID,
            csrf,
            semesterId as string,
            client,
            courseCreditMap
        );

        try {
            if (marksRes && typeof marksRes !== "string") {
                const identityRes = await client.post(
                    "/vtop/studentsRecord/StudentProfileAllView",
                    new URLSearchParams({
                        verifyMenu: "true",
                        authorizedID: String(authorizedID),
                        _csrf: String(csrf),
                        nocache: Date.now().toString(),
                    }).toString(),
                    { headers: { Cookie: cookieHeader, "Content-Type": "application/x-www-form-urlencoded" } }
                );
                const profile = parseStudentProfile(identityRes.data);
                const regNumber = profile.registerNo || profile.applicationNumber;

                if (!regNumber) {
                    console.warn("attendance(htmlparser2): no REGISTER NO in profile response — enrollment skipped");
                } else {
                    const ownerKey = ownerKeyFor(regNumber);
                    const classIds = (marksRes.courses ?? [])
                        .map((c) => c.classNbr)
                        .filter((id): id is string => typeof id === "string" && id.length > 0);

                    await ensureSchema();
                    await recordEnrollment(ownerKey, classIds, Date.now());
                    console.log(`attendance(htmlparser2): enrollment recorded for ${classIds.length} classes`);
                }
            }
        } catch (enrollErr: unknown) {
            console.error(
                "attendance(htmlparser2): enrollment unavailable:",
                enrollErr instanceof Error ? enrollErr.message : String(enrollErr)
            );
        }

        const doc = parseDocument(ttRes.data);
        const attendance: attendanceItem[] = [];

        const rows = selectAll("#getStudentDetails table tr", doc);
        for (const row of rows) {
            const cols = getCells(row);
            if (cols.length < 10) continue;

            const code = textOf(cols[1]);
            const slot = textOf(cols[4]);
            attendance.push({
                slNo: textOf(cols[0]),
                courseCode: slot.startsWith("L") ? code + "(L)" : code + "(T)",
                courseTitle: textOf(cols[2]),
                courseType: textOf(cols[3]),
                slotName: slot,
                faculty: textOf(cols[5]).replace(/\s+/g, " ").trim(),
                registrationDate: textOf(cols[7]),
                attendanceDate: textOf(cols[8]),
                attendedClasses: parseInt(textOf(cols[9]), 10),
                totalClasses: parseInt(textOf(cols[10]), 10),
                attendancePercentage: textOf(cols[11]),
                viewLink: (() => {
                    const link = selectAll("a", cols[13] ?? row)[0] as Element | undefined;
                    return link ? (getAttributeValue(link, "onclick") ?? null) : null;
                })(),
            });
        }

        const mergedAttendance: attendanceItem[] =
            mergeAttendanceWithTimetable(attendance, courseInfo);

        async function fetchDetail(course: attendanceItem): Promise<attendanceItem> {
            if (!course.viewLink || typeof course.viewLink !== "string") return course;

            const match = course.viewLink.match(
                /processViewAttendanceDetail\('([^']+)','([^']+)'\)/
            );
            if (!match) return course;

            const [, classId, slotName] = match;

            try {
                const attendanceRes = await client.post(
                    "/vtop/processViewAttendanceDetail",
                    new URLSearchParams({
                        _csrf: String(csrf),
                        authorizedID: String(authorizedID),
                        x: Date.now().toString(),
                        classId: String(classId),
                        slotName: String(slotName),
                    }).toString(),
                    {
                        headers: {
                            Cookie: cookieHeader,
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                    }
                );

                const detailDoc = parseDocument(attendanceRes.data);
                const detailed: Array<{ date: string; status: string }> = [];
                const detailRows = selectAll("table.table tr", detailDoc);

                for (let i = 0; i < detailRows.length; i++) {
                    if (i === 0) continue; // header
                    const cols = getCells(detailRows[i]);
                    if (cols.length < 5) continue;
                    detailed.push({
                        date: textOf(cols[1]),
                        status: textOf(cols[4]),
                    });
                }

                course.viewLink = detailed as unknown as typeof course.viewLink;
            } catch (err: unknown) {
                console.error(
                    `Failed fetching detail for ${course.courseCode}`,
                    (err instanceof Error ? err.message : String(err))
                );
            }

            return course;
        }

        const detailedAttendance: attendanceItem[] = await batchAll(
            mergedAttendance, fetchDetail, 3
        );

        return NextResponse.json(
            { attRes: { semester: semesterId, attendance: detailedAttendance }, marksRes: marksRes },
            { status: 200 }
        );
    } catch (err: unknown) {
        console.error(err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
