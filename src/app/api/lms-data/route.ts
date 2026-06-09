import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import LMSClient from "@/lib/clients/LMSClient";



interface Assingment {
    name: string;
    due: string;
    done: boolean;
    day: number;
    month: number;
    year: number;
    url: string;
}



/**
 * @openapi
 * /api/lms-data:
 *   post:
 *     tags:
 *       - Lms-data
 *     summary: POST endpoint for /api/lms-data
 *     parameters:
 *       - name: id
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
 *               username:
 *                 type: string
 *               pass:
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
        const {  username, pass  } = await req.json().catch(()=>({}));
        if (!username || !pass) {
            return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
        }

        const result = await ScrapeLMS(username, pass);

        return NextResponse.json(result, { status: 200 });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}



async function ScrapeLMS(username: string, password: string): Promise<Assingment[]> {
    try {
        const getRes = await LMSClient.get("/login/index.php");
        const cookies = getRes.headers["set-cookie"]?.join("; ") || "";

        const $ = cheerio.load(getRes.data);
        const token = $('input[name="logintoken"]').val() || "";

        const formData = new URLSearchParams();
        formData.append("logintoken", token.toString());
        formData.append("username", username);
        formData.append("password", password);

        const postRes = await LMSClient.post("/login/index.php", formData.toString(), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": cookies
            },
            maxRedirects: 0,
            validateStatus: () => true
        });

        const loginCookies = postRes.headers["set-cookie"]?.join("; ") || cookies;
        const redirectUrl = postRes.headers.location;

        const redirectRes = await LMSClient.get(redirectUrl, {
            headers: {
                Cookie: loginCookies
            }
        });

        const sesskeyMatch = redirectRes.data.match(/"sesskey":"([^"]+)"/);
        const sesskey = sesskeyMatch?.[1];

        if (!sesskey) {
            throw new Error("Cannot find sesskey");
        }

        const now = new Date();

        let currentMonth = now.getMonth() + 1;
        let currentYear = now.getFullYear();

        let prevMonth = currentMonth - 1;
        let prevYear = currentYear;

        if (prevMonth < 1) {
            prevMonth = 12;
            prevYear--;
        }

        let nextMonth = currentMonth + 1;
        let nextYear = currentYear;

        if (nextMonth > 12) {
            nextMonth = 1;
            nextYear++;
        }

        const calendarEventsCurrent = extractCalendarEvents(redirectRes.data);

        // const prevMonthHTML = await fetchCalendarMonthHTML(
        //     sesskey,
        //     prevYear,
        //     prevMonth,
        //     loginCookies
        // );

        // const nextMonthHTML = await fetchCalendarMonthHTML(
        //     sesskey,
        //     nextYear,
        //     nextMonth,
        //     loginCookies
        // );

        // const calendarEventsPrev = extractCalendarEvents(prevMonthHTML);
        // const calendarEventsNext = extractCalendarEvents(nextMonthHTML);

        const allEvents = [
            // ...calendarEventsPrev,
            ...calendarEventsCurrent,
            // ...calendarEventsNext
        ];

        const eventPromises = allEvents.flatMap(dayData =>
            dayData.events.map(async (ev: any) => {
                try {
                    const eventRes = await LMSClient.get(ev.link, {
                        headers: { Cookie: loginCookies }
                    });

                    const $ = cheerio.load(eventRes.data);

                    const courseLink = $("ol.breadcrumb li.breadcrumb-item a")
                        .first()
                        .attr("href");

                    let teachers: string[] = [];

                    if (courseLink) {
                        const courseId = new URL(courseLink).searchParams.get("id");
                        const moduleId = new URL(ev.link).searchParams.get("id");

                        if (courseId && moduleId) {
                            const courseRes = await LMSClient.get(
                                `/course/view.php?id=${courseId}`,
                                { headers: { Cookie: loginCookies } }
                            );

                            teachers = extractTeacherForModule(courseRes.data, moduleId);
                        }
                    }

                    const courseCodeFull = $("ol.breadcrumb li.breadcrumb-item a")
                        .first()
                        .text()
                        .trim();
                    const courseNameFull = $("ol.breadcrumb li.breadcrumb-item a")
                        .first()
                        .attr("title") || "";
                    const assignmentName = $("h1.h2").first().text().trim();
                    const name = `${courseCodeFull}/${courseNameFull}/${assignmentName}`;

                    const dueText = $('div.activity-dates strong:contains("Due:")')
                        .parent()
                        .text()
                        .replace("Due:", "")
                        .trim();

                    const isDone = $('[data-region="completion-info"] button.btn-success').length > 0;

                    return {
                        name,
                        due: dueText,
                        done: isDone,
                        day: dayData.day,
                        month: dayData.month,
                        year: dayData.year,
                        url: ev.link,
                        teachers
                    };
                } catch (err: any) {
                    console.error("❌ Failed parsing:", ev.link, err.message);
                    return null;
                }
            })
        );

        const finalResults = (await Promise.all(eventPromises))
            .filter(Boolean);

        return finalResults;
    } catch (err: any) {
        console.error("Error:", err.message);
        throw err;
    }
}

function extractCalendarEvents(html: string) {
    const $ = cheerio.load(html);
    const events: any[] = [];

    $("td.day.hasevent").each((i, el) => {
        const day = $(el).data("day");
        const month = $(el).find("a[data-day]").data("month") || null;
        const year = $(el).find("a[data-day]").data("year") || null;

        const dayEvents: any[] = [];

        $(el)
            .find('[data-region="event-item"] a[data-action="view-event"]')
            .each((j, ev) => {
                const title = $(ev).find(".eventname").text().trim();
                const link = $(ev).attr("href");
                dayEvents.push({ title, link });
            });

        events.push({ day, month, year, events: dayEvents });
    });

    return events;
}

async function fetchCalendarMonthHTML(sesskey: string, year: number, month: number, cookies: string): Promise<string> {
    const body = [
        {
            index: 0,
            methodname: "core_calendar_get_calendar_monthly_view",
            args: {
                year: String(year),
                month: String(month),
                courseid: 1,
                day: 1,
                view: "monthblock"
            }
        }
    ];

    const res = await LMSClient.post(
        `/lib/ajax/service.php?sesskey=${encodeURIComponent(sesskey)}&info=core_calendar_get_calendar_monthly_view`,
        JSON.stringify(body),
        {
            headers: {
                "Content-Type": "application/json",
                Cookie: cookies
            }
        }
    );
    return res.data[0]?.data?.html || "";
}

function extractTeacherForModule(courseHTML: string, moduleId: string): string[] {
    const $ = cheerio.load(courseHTML);

    const moduleEl = $(`#module-${moduleId}`);
    if (!moduleEl.length) return [];
    const sectionEl = moduleEl.closest('li[id^="section-"]');
    if (!sectionEl.length) return [];
    const sectionTitle = sectionEl.find("h3.sectionname").first().text().trim();
    if (!sectionTitle) return [];
    const match = sectionTitle.match(/^(Dr\.?\s+[A-Za-z.\s]+)/i);
    return match ? [(match[1] ?? "Unknown").trim()] : [sectionTitle];
}
