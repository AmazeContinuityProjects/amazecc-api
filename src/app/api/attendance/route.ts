import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import * as cheerio from "cheerio";
import { URLSearchParams } from "url";
import fetchTimetable from "@/lib/fetchTimeTable";
import { attendanceItem, courseItem } from "@/types/data/attendance";

import { getMarks } from "@/lib/marks";
import { parseStudentProfile } from "@/lib/parsers/student-profile";
import {
    ensureSchema,
    ownerKeyFor,
    recordEnrollment,
} from "@/lib/marksStats";
import {
    alreadyContributed,
    deriveClassDetails,
    recordClassDetails,
} from "@/lib/classDetails";

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
 * @openapi
 * /api/attendance:
 *   get:
 *     tags:
 *       - Attendance
 *     summary: GET endpoint for /api/attendance
 *     parameters:
 *       - name: classId
 *         in: query
 *         required: false
 *         schema:
 *           type: string
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
 *   post:
 *     tags:
 *       - Attendance
 *     summary: POST endpoint for /api/attendance
 *     parameters:
 *       - name: classId
 *         in: query
 *         required: false
 *         schema:
 *           type: string
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

        // The caller's identity, resolved from VTOP's own response and never from
        // the request body, and the two things that hang off it.
        //
        // 1. Which classes this caller is enrolled in, from the class list the
        //    marks fetch itself just returned under their own cookies. That is
        //    what lets the cohort-statistics read verify each requested class:
        //    the list came back from VTOP, so a caller cannot enroll into a class
        //    they are not in.
        //
        // 2. The class details this caller contributes: the rooms, faculty and
        //    slots of their own classes. No single student sees the campus
        //    timetable, but every student who syncs sees their part of it, and
        //    the union is what the free-room finder is built on. The timetable
        //    this route has already fetched is the source, so this costs no
        //    extra VTOP call.
        //
        // Both writes are best-effort — a failure here must not take the
        // attendance or marks payload down with it, and the statistics read
        // degrades to empty.
        try {
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
                console.warn("attendance: no REGISTER NO in profile response — enrollment skipped");
            } else {
                const ownerKey = ownerKeyFor(regNumber);

                if (marksRes && typeof marksRes !== "string") {
                    const classIds = (marksRes.courses ?? [])
                        .map((c) => c.classNbr)
                        .filter((id): id is string => typeof id === "string" && id.length > 0);

                    await ensureSchema();
                    await recordEnrollment(ownerKey, classIds, Date.now());
                    console.log(`attendance: enrollment recorded for ${classIds.length} classes`);
                }

                // One contribution per student per semester. The gate is a row in
                // `class_sync_state` holding this student's hashed identity: the
                // timetable barely changes once it is set, so the second sync of
                // the term is a no-op rather than a rewrite. The next semester is
                // a new semester id, and therefore a fresh contribution, with
                // nothing to reinitiate.
                if (semesterId && !(await alreadyContributed(ownerKey, String(semesterId)))) {
                    const details = deriveClassDetails(courseInfo);
                    const outcome = await recordClassDetails(
                        ownerKey,
                        String(semesterId),
                        details,
                        Date.now()
                    );
                    console.log(
                        outcome.skipped
                            ? "attendance: class details already contributed for this semester"
                            : `attendance: class details recorded for ${outcome.classes} classes`
                    );
                }
            }
        } catch (contribErr: unknown) {
            console.error(
                "attendance: enrollment/class details unavailable:",
                contribErr instanceof Error ? contribErr.message : String(contribErr)
            );
        }

        const $$$ = cheerio.load(ttRes.data);
        const attendance: attendanceItem[] = [];

        $$$("#getStudentDetails table tbody tr").each((i, row) => {
            const cols = $$$(row).find("td");

            if (cols.length < 10) return;

            attendance.push({
                slNo: cols.eq(0).text().trim(),
                courseCode: cols.eq(4).text().trim().startsWith("L")
                    ? cols.eq(1).text().trim() + "(L)"
                    : cols.eq(1).text().trim() + "(T)",
                courseTitle: cols.eq(2).text().trim(),
                courseType: cols.eq(3).text().trim(),
                slotName: cols.eq(4).text().trim(),
                faculty: cols.eq(5).text().replace(/\s+/g, " ").trim(),
                registrationDate: cols.eq(7).text().trim(),
                attendanceDate: cols.eq(8).text().trim(),
                attendedClasses: parseInt(cols.eq(9).text().trim()),
                totalClasses: parseInt(cols.eq(10).text().trim()),
                attendancePercentage: cols.eq(11).text().trim(),
                viewLink: cols.eq(13).find("a").attr("onclick") || null,
            });
        });

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

                const $$$ = cheerio.load(attendanceRes.data);
                const detailed: Array<{ date: string; status: string }> = [];

                $$$("table.table tr").each((i, row) => {
                    if (i === 0) return;

                    const cols = $$$(row).find("td");
                    if (cols.length < 5) return;

                    detailed.push({
                        date: cols.eq(1).text().trim(),
                        status: cols.eq(4).text().trim(),
                    });
                });

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


