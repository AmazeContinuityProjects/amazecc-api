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

        // Parse the tables in the profile page
        // Usually, the registered events table is the one with headers "S.No", "Event Name", "Order Id" etc.
        $('table').each((_, table) => {
            const headers = $(table).find('tr').first().text().trim().toLowerCase();
            if (headers.includes('event') && (headers.includes('order') || headers.includes('payment') || headers.includes('receipt'))) {
                $(table).find('tr').each((i, row) => {
                    if (i === 0) return; // Skip header row

                    const cols = $(row).find('td');
                    if (cols.length >= 8) {
                        const eventName = $(cols[1]).text().trim();
                        const orderId = $(cols[2]).text().trim();
                        const eventDate = $(cols[3]).text().trim();
                        const eventVenue = $(cols[4]).text().trim();
                        const eventTime = $(cols[5]).text().trim();
                        const paymentStatus = $(cols[6]).text().trim();
                        
                        // Extract receipt/certificate/payment links
                        let receiptLink = null;
                        let certificateLink = null;
                        let payNowLink = null;
                        let payLaterLink = null;
                        let eid = '';

                        $(row).find('td').slice(7).find('button, a, input').each((_, el) => {
                            const text = $(el).text().trim().toLowerCase() || $(el).attr('value')?.toLowerCase() || '';
                            const onclick = $(el).attr('onclick') || '';
                            const href = $(el).attr('href') || '';
                            
                            // Extract eid from onclick/href patterns
                            const eidMatch = onclick.match(/getRecepit\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/i);
                            if (eidMatch) {
                                eid = eidMatch[1];
                            }
                            if (!eid) {
                                const hrefMatch = href.match(/studentRecepit\/([^/]+)/);
                                if (hrefMatch) eid = hrefMatch[1];
                            }
                            if (!eid) {
                                const payMatch = onclick.match(/paynow\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/i);
                                if (payMatch) eid = payMatch[1];
                            }
                            
                            if (text.includes('receipt')) {
                                if (href && href !== '#') {
                                    receiptLink = href;
                                } else if (onclick.includes('getRecepit')) {
                                    const match = onclick.match(/getRecepit\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/i);
                                    if (match) receiptLink = `/EventHub/studentRecepit/${match[1]}/`;
                                }
                            }
                            
                            if (text.includes('certificate') || text.includes('download')) {
                                const action = href || $(el).attr('formaction') || '';
                                if (action && action !== '#') certificateLink = action;
                            }

                            if (text.includes('pay now') || onclick.toLowerCase().includes('paynow')) {
                                const action = href || $(el).attr('formaction') || '';
                                if (action && action !== '#') payNowLink = action;
                                else {
                                    const match = onclick.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
                                    if (match) payNowLink = match[1];
                                }
                            }

                            if (text.includes('pay later')) {
                                const action = href || $(el).attr('formaction') || '';
                                if (action && action !== '#') payLaterLink = action;
                            }
                        });

                        registeredEvents.push({
                            name: eventName,
                            eid,
                            orderId,
                            date: eventDate,
                            time: eventTime,
                            venue: eventVenue,
                            paymentStatus,
                            receiptLink,
                            certificateLink,
                            payNowLink,
                            payLaterLink
                        });
                    }
                });
            }
        });

        return NextResponse.json({ events: registeredEvents }, { status: 200 });

    } catch (err: unknown) {
        console.error(err);
        return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) || "Internal server error" }, { status: 500 });
    }
}
