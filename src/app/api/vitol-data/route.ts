import { NextResponse } from "next/server";
import type { AxiosInstance } from "axios";
import * as cheerio from "cheerio";
import getVitolClient from "@/lib/clients/VitolClient";



interface Assingment {
    name: string;
    opens: string;
    done: boolean;
    day: number;
    month: number;
    year: number;
    url: string;
}



/**
 * @openapi
 * /api/vitol-data:
 *   post:
 *     tags:
 *       - Vitol-data
 *     summary: POST endpoint for /api/vitol-data
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
 *               vitolSite:
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
        const {  username, pass, vitolSite  } = await req.json().catch(()=>({}));
        if (!username || !pass || !vitolSite) {
            return NextResponse.json({ error: "Username, password and vitolSite are required." }, { status: 400 });
        }

        const result = await ScrapeVitolData(username, pass, vitolSite);

        return NextResponse.json(result, { status: 200 });
    } catch (err: unknown) {
        console.error(err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}



async function ScrapeVitolData(username: string, password: string, vitolSite: string): Promise<Assingment[]> {
    try {
        const VitolClient = getVitolClient(vitolSite);
        const getRes = await VitolClient.get("/login/index.php");
        const cookies = getRes.headers["set-cookie"]?.join("; ") || "";

        const $ = cheerio.load(getRes.data);
        const token = $('input[name="logintoken"]').val() || "";

        const formData = new URLSearchParams();
        formData.append("logintoken", token.toString());
        formData.append("username", username);
        formData.append("password", password);

        const postRes = await VitolClient.post("/login/index.php", formData.toString(), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": cookies
            },
            maxRedirects: 0,
            validateStatus: () => true
        });

        const loginCookies = postRes.headers["set-cookie"]?.join("; ") || cookies;
        const redirectUrl = postRes.headers.location;

        const redirectRes = await VitolClient.get(redirectUrl, {
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

        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();


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

        const nextMonthHTML = await fetchCalendarMonthHTML(
            sesskey,
            nextYear,
            nextMonth,
            loginCookies,
            VitolClient
        );

        // const calendarEventsPrev = extractCalendarEvents(prevMonthHTML);
        const calendarEventsNext = extractCalendarEvents(nextMonthHTML);

        const allEvents = [
            // ...calendarEventsPrev,
            ...calendarEventsCurrent,
            ...calendarEventsNext
        ];

        const urlSet = new Set<string>();
        const finalResults: Assingment[] = [];

        for (const dayData of allEvents) {
            for (const ev of (dayData as Record<string, unknown>).events as Array<Record<string, unknown> & { link: string }>) {
                try {
                    const eventRes = await VitolClient.get(ev.link, {
                        headers: {
                            Cookie: loginCookies
                        }
                    });

                    const $ = cheerio.load(eventRes.data);

                    const courseCodeFull = $("ol.breadcrumb li.breadcrumb-item a")
                        .first()
                        .text()
                        .trim();
                    const courseNameFull = $("ol.breadcrumb li.breadcrumb-item a")
                        .first()
                        .attr("title") || "";
                    const assignmentName = $("h1.h2").first().text().trim();
                    const name = `${courseCodeFull}/${courseNameFull}/${assignmentName}`;

                    const opensText = $('div.activity-dates strong')
                        .filter((_, el) => {
                            const text = $(el).text()
                            return text.includes('Opens:') || text.includes('Opened:')
                        })
                        .parent()
                        .text()
                        .replace(/Opens:|Opened:/, '')
                        .trim()

                    const isDone = $('table.quizattemptsummary:contains("Finished")').length > 0;

                    if (!urlSet.has(ev.link)) {
                        urlSet.add(ev.link);

                        finalResults.push({
                            name,
                            opens: opensText,
                            done: isDone,
                            day: dayData.day as number,
                            month: dayData.month as number,
                            year: dayData.year as number,
                            url: ev.link
                        });
                    }

                } catch (err: unknown) {
                    console.error("❌ Failed parsing:", ev.link, (err instanceof Error ? err.message : String(err)));
                }
            }
        }
        return finalResults;
    } catch (err: unknown) {
        console.error("Error:", (err instanceof Error ? err.message : String(err)));
        throw err;
    }
}

function extractCalendarEvents(html: string) {
    const $ = cheerio.load(html);
    const events: Array<Record<string, unknown>> = [];

    $("td.day.hasevent").each((i, el) => {
        const day = $(el).data("day");
        const month = $(el).find("a[data-day]").data("month") || null;
        const year = $(el).find("a[data-day]").data("year") || null;

        const dayEvents: Array<Record<string, unknown>> = [];

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

async function fetchCalendarMonthHTML(sesskey: string, year: number, month: number, cookies: string, VitolClient: AxiosInstance): Promise<string> {
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

    const res = await VitolClient.post(
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
