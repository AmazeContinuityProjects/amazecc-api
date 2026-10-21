/**
 * @openapi
 * /api/events/profile:
 *   post:
 *     tags:
 *       - Events
 *     summary: Auto-generated POST endpoint for /api/events/profile
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

import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { getEventHubCookie, looksLikeLoginPage } from "@/lib/eventHubAuth";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { username, password, jsessionid } = body;

        let cookie = await getEventHubCookie({ username, password, jsessionid });

        if (!cookie) {
            return NextResponse.json({ error: "Failed to authenticate with Event Hub. Please check your credentials." }, { status: 401 });
        }

        // Fetch Profile page
        const profileRes = await fetch('https://eventhubcc.vit.ac.in/EventHub/profile', {
            method: 'GET',
            headers: {
                'Cookie': cookie,
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (!profileRes.ok) {
            throw new Error(`Failed to load Event Hub profile: ${profileRes.status}`);
        }

        let html = await profileRes.text();
        let $ = cheerio.load(html);

        /*
         * A cached session can expire server-side with no signal to the client,
         * and EventHub answers an expired session with the LOGIN page rather than
         * a 403. The old code read that as bad credentials, so an expired cache
         * produced a 401 telling the user to check a password that was perfectly
         * fine.
         *
         * So distinguish the two, and when credentials were supplied, spend one
         * login proving it. The frontend does not send them today (it re-logs-in
         * client-side instead, which is the cheaper fix) but this makes the route
         * self-sufficient and correct if that ever changes.
         */
        if (looksLikeLoginPage(html)) {
            if (username && password) {
                const fresh = await getEventHubCookie({ username, password });
                if (fresh) {
                    const retry = await fetch('https://eventhubcc.vit.ac.in/EventHub/profile', {
                        method: 'GET',
                        headers: { 'Cookie': fresh, 'User-Agent': 'Mozilla/5.0' }
                    });
                    if (retry.ok) {
                        const retryHtml = await retry.text();
                        if (!looksLikeLoginPage(retryHtml)) {
                            cookie = fresh;
                            html = retryHtml;
                            $ = cheerio.load(html);
                        }
                    }
                }
            }

            if (looksLikeLoginPage(html)) {
                // Still the login page. If we never held a session, this is a
                // credentials problem; if we did, the session simply expired.
                const expired = Boolean(jsessionid);
                return NextResponse.json(
                    {
                        error: expired
                            ? "Event Hub session expired. Log in again to refresh it."
                            : "Event Hub authentication failed. Please check your credentials.",
                        reason: expired ? "session_expired" : "invalid_credentials",
                        // Tells the client to discard its cached session rather
                        // than retrying the same dead one.
                        reauthenticate: expired,
                    },
                    { status: 401 }
                );
            }
        }

        const registeredEvents: unknown[] = [];

        // EventHub profile layout (verified Oct 2026 against live HTML):
        // #regTable has 9 columns:
        //   0 S.No | 1 Event Name | 2 Order Id | 3 Event Date | 4 Event Venue |
        //   5 Event Time | 6 Payment Status (either plain text "Paid"/"Free Event"
        //   or a "Pay Now" <a href="/EventHub/showPaymentTC/<orderId>">) |
        //   7 Receipt (<a href="/EventHub/receipt/<orderId>"> or "Free Event") |
        //   8 Certificate (<a href="/EventHub/conf/getCertificate/<certId>"> or "---")
        // Past/closed registrations render plain links, but still-live
        // registrations sometimes render the old-style action buttons with the
        // event id (eid) in `onclick` handlers, so `eid` is extracted on a
        // best-effort basis and is null only when the page carries no eid.
        const ABS = "https://eventhubcc.vit.ac.in";
        const absolutize = (href: string | undefined): string | null => {
            if (!href || href === "#") return null;
            if (/^https?:\/\//i.test(href)) return href;
            if (href.startsWith("/")) return `${ABS}${href}`;
            return `${ABS}/EventHub/${href}`;
        };

        // Best-effort eid extraction. Covers the legacy onclick patterns
        // (still rendered for live registrations) plus generic carriers
        // (eid query param, name="eid" inputs/buttons, data-eid).
        const extractEid = ($row: any): string | null => {
            let eid: string | null = null;
            $row.find("button, a, input").each((_: number, el: any) => {
                if (eid) return;
                const onclick = $(el).attr("onclick") || "";
                const href = $(el).attr("href") || "";
                const formaction = $(el).attr("formaction") || "";
                const name = $(el).attr("name") || "";
                const value = ($(el).attr("value") ?? "").toString();

                const legacy =
                    onclick.match(/getRecepit\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/i)?.[1] ??
                    href.match(/studentRecepit\/([^/]+)/)?.[1] ??
                    onclick.match(/paynow\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/i)?.[1];
                if (legacy) {
                    eid = legacy;
                    return;
                }
                const generic =
                    href.match(/[?&]eid=([^&#\s]+)/i)?.[1] ??
                    formaction.match(/[?&]eid=([^&#\s]+)/i)?.[1] ??
                    onclick.match(/[?&]eid=([^&#'"\s]+)/i)?.[1];
                if (generic) {
                    eid = generic;
                    return;
                }
                if (name.toLowerCase() === "eid" && value) {
                    eid = value;
                    return;
                }
            });
            return eid;
        };

        const parseRegTable = ($table: any) => {
            $table.find("tr").each((i: number, row: any) => {
                if (i === 0) return; // Skip header row

                const cols = $(row).find("td");
                if (cols.length < 7) return;

                const eventName = $(cols[1]).text().trim();
                const orderId = $(cols[2]).text().trim();
                if (!eventName || !orderId) return;

                const eventDate = $(cols[3]).text().trim();
                const eventVenue = $(cols[4]).text().trim();
                const eventTime = $(cols[5]).text().trim();

                // Payment cell (col 6): text or Pay Now link.
                const paymentCell = $(cols[6]);
                const payAnchor =
                    paymentCell.find('a[href*="showPaymentTC"]').first().length
                        ? paymentCell.find('a[href*="showPaymentTC"]').first()
                        : $(row).find('a[href*="showPaymentTC"]').first();
                const payHref = payAnchor.length ? payAnchor.attr("href") : undefined;
                const payNowUrl = absolutize(payHref ?? undefined);
                const paymentStatus = payNowUrl
                    ? "Pay Now"
                    : paymentCell.text().trim().replace(/\s+/g, " ");

                // Receipt cell (col 7): /EventHub/receipt/<orderId> or "Free Event".
                const receiptCell = cols.length > 7 ? $(cols[7]) : null;
                const receiptAnchor = receiptCell?.find('a[href*="/receipt/"]').first();
                const receiptHref = receiptAnchor?.length ? receiptAnchor.attr("href") : undefined;
                const receiptUrl = absolutize(receiptHref ?? undefined);
                const receiptId = receiptHref
                    ? (receiptHref.match(/\/receipt\/([^/?#]+)/)?.[1] ?? null)
                    : null;

                // Certificate cell (col 8): /EventHub/conf/getCertificate/<certId> or "---".
                const certCell = cols.length > 8 ? $(cols[8]) : null;
                const certAnchor = certCell?.find('a[href*="getCertificate"]').first();
                const certHref = certAnchor?.length ? certAnchor.attr("href") : undefined;
                const certificateUrl = absolutize(certHref ?? undefined);
                const certificateId = certHref
                    ? (certHref.match(/getCertificate\/([^/?#]+)/)?.[1] ?? null)
                    : null;

                registeredEvents.push({
                    name: eventName,
                    // The event id is only rendered for still-live
                    // registrations (old-style action buttons); past/closed
                    // rows carry no eid, so this is null for those.
                    eid: extractEid($(row)),
                    orderId,
                    date: eventDate,
                    time: eventTime,
                    venue: eventVenue,
                    paymentStatus,
                    receiptId,
                    certificateId,
                    receiptUrl,
                    certificateUrl,
                    payNowUrl,
                    payLaterLink: null,
                    // Legacy aliases (now absolute URLs, or null).
                    receiptLink: receiptUrl,
                    certificateLink: certificateUrl,
                    payNowLink: payNowUrl,
                });
            });
        };

        const regTable = $("#regTable");
        if (regTable.length) {
            parseRegTable(regTable);
        } else {
            // Fallback for any future markup: any table whose header mentions
            // event + order/payment/receipt.
            $("table").each((_, table) => {
                const headers = $(table).find("tr").first().text().trim().toLowerCase();
                if (headers.includes("event") && (headers.includes("order") || headers.includes("payment") || headers.includes("receipt"))) {
                    parseRegTable($(table));
                }
            });
        }

        return NextResponse.json({ events: registeredEvents }, { status: 200 });

    } catch (err: unknown) {
        console.error(err);
        return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) || "Internal server error" }, { status: 500 });
    }
}
