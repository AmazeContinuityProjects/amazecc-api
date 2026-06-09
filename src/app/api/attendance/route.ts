import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import * as cheerio from "cheerio";
import { URLSearchParams } from "url";
import fetchTimetable from "@/lib/fetchTimeTable";
import { RequestBody } from "@/types/custom";
import { attendanceItem, courseItem } from "@/types/data/attendance";

import { getMarks } from "@/lib/marks";
import { fetchClassStatistics } from "@/lib/addClassData";





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
                const detailed: any[] = [];

                $$$("table.table tr").each((i, row) => {
                    if (i === 0) return;

                    const cols = $$$(row).find("td");
                    if (cols.length < 5) return;

                    detailed.push({
                        date: cols.eq(1).text().trim(),
                        status: cols.eq(4).text().trim(),
                    });
                });

                course.viewLink = detailed;
            } catch (err: any) {
                console.error(
                    `Failed fetching detail for ${course.courseCode}`,
                    err.message
                );
            }

            return course;
        }

        const detailedAttendance: attendanceItem[] = await Promise.all(
            mergedAttendance.map(fetchDetail)
        );

        return NextResponse.json({ attRes: { semester: semesterId, attendance: detailedAttendance }, marksRes: marksRes }, { status: 200 });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const searchParams = new URL(req.url).searchParams;
    const classId = searchParams.get("classId") || "";
        const stats = await fetchClassStatistics(classId);
        
        if (!stats || stats.mean === undefined) {
            return NextResponse.json({ error: "Class statistics not found" }, { status: 404 });
        }
        return NextResponse.json(stats, { status: 200 });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}


