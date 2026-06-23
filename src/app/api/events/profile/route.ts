import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
        }

        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

        // Step 1: Login to Event Hub
        const loginParams = new URLSearchParams({ username, password, validateVitian: "1" });
        const loginRes = await fetch('https://eventhubcc.vit.ac.in/EventHub/mainDashboard', {
            method: 'POST',
            body: loginParams,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0'
            },
            redirect: 'manual'
        });

        // Extract JSESSIONID
        const setCookieHeader = loginRes.headers.get('set-cookie');
        let jsessionid = '';
        if (setCookieHeader) {
            const match = setCookieHeader.match(/JSESSIONID=([^;]+)/);
            if (match) {
                jsessionid = `JSESSIONID=${match[1]}`;
            }
        }

        if (!jsessionid) {
            return NextResponse.json({ error: "Failed to authenticate with Event Hub. Please check your credentials." }, { status: 401 });
        }

        // Step 2: Fetch Profile page
        const profileRes = await fetch('https://eventhubcc.vit.ac.in/EventHub/profile', {
            method: 'GET',
            headers: {
                'Cookie': jsessionid,
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (!profileRes.ok) {
            throw new Error(`Failed to load Event Hub profile: ${profileRes.status}`);
        }

        const html = await profileRes.text();
        const $ = cheerio.load(html);

        // If the profile page has a login form, our login failed
        if ($('form[action="/EventHub/mainDashboard"]').length > 0) {
            return NextResponse.json({ error: "Event Hub authentication failed. Please check your credentials." }, { status: 401 });
        }

        const registeredEvents: any[] = [];

        // Parse the tables in the profile page
        // Usually, the registered events table is the one with headers "S.No", "Event Name", "Order Id" etc.
        $('table').each((_, table) => {
            const headers = $(table).find('tr').first().text().trim().toLowerCase();
            if (headers.includes('event name') && headers.includes('payment status')) {
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

                        $(row).find('td').slice(7).find('button, a, input').each((_, el) => {
                            const text = $(el).text().trim().toLowerCase() || $(el).attr('value')?.toLowerCase() || '';
                            const onclick = $(el).attr('onclick');
                            const href = $(el).attr('href');
                            
                            if (text.includes('receipt')) {
                                if (href && href !== '#') {
                                    receiptLink = href;
                                } else if (onclick && onclick.includes('getRecepit')) {
                                    const match = onclick.match(/getRecepit\('([^']+)'\)/);
                                    if (match) receiptLink = `/EventHub/studentRecepit/${match[1]}/`;
                                }
                            }
                            
                            if (text.includes('certificate') || text.includes('download')) {
                                const action = href || $(el).attr('formaction') || '';
                                if (action && action !== '#') certificateLink = action;
                            }

                            if (text.includes('pay now') || (onclick && onclick.toLowerCase().includes('paynow'))) {
                                const action = href || $(el).attr('formaction') || '';
                                if (action && action !== '#') payNowLink = action;
                                else if (onclick) {
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

    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
