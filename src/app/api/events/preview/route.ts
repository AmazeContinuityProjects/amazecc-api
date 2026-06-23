import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(req: Request) {
    try {
        const { username, password, eid } = await req.json().catch(() => ({}));

        if (!username || !password || !eid) {
            return NextResponse.json({ error: "Missing username, password, or eid" }, { status: 400 });
        }

        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

        // Step 1: Login to Event Hub
        const loginParams = new URLSearchParams({
            username: username,
            password: password,
            validateVitian: "1"
        });

        const loginRes = await fetch('https://eventhubcc.vit.ac.in/EventHub/mainDashboard', {
            method: 'POST',
            body: loginParams,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0'
            },
            redirect: 'manual' // We need to grab the cookie from the 302 response
        });

        const setCookieHeader = loginRes.headers.get('set-cookie');
        let jsessionid = '';
        
        if (setCookieHeader) {
            // e.g., "JSESSIONID=xxxxx; Path=/EventHub; HttpOnly"
            const match = setCookieHeader.match(/JSESSIONID=([^;]+)/);
            if (match) {
                jsessionid = `JSESSIONID=${match[1]}`;
            }
        }

        if (!jsessionid) {
            // Sometimes it returns 200 OK directly if login fails, or the cookie is in a different format
            // We'll proceed with whatever cookie we found or fail gracefully.
            return NextResponse.json({ error: "Failed to authenticate with Event Hub. Invalid credentials?" }, { status: 401 });
        }

        // Step 2: Fetch Event Preview
        const previewParams = new URLSearchParams({ eid: String(eid) });
        const previewRes = await fetch('https://eventhubcc.vit.ac.in/EventHub/eventPreview', {
            method: 'POST',
            body: previewParams,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': jsessionid,
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (!previewRes.ok) {
            throw new Error(`Failed to load Event Preview: ${previewRes.status}`);
        }

        const html = await previewRes.text();
        const $ = cheerio.load(html);

        // Extract description details based on actual HTML structure
        let description = '';
        const metaDetails: Record<string, string> = {};

        $('.list-group-item').each((i, el) => {
            const label = $(el).find('.fw-bold').text().trim();
            if (label === 'Event Description') {
                description = $(el).find('span').not('.badge').text().trim();
            } else if (label) {
                // Extract Participants, Event Date, Event Venue, Event Time, Conducted By
                let value = $(el).find('span').not('.badge').text().trim();
                // Sometimes it's inside a label inside the span
                const labelText = $(el).find('span label').text().trim();
                if (labelText) value = labelText;
                
                metaDetails[label] = value;
            }
        });

        // Extract Total Fees
        const feeInput = $('#EventFees1');
        if (feeInput.length) {
            metaDetails['Total Fees'] = feeInput.val()?.toString() || '0';
        }

        // Find the image URL
        let imageUrl = '';
        const imgEl = $('.eventPoster img');
        if (imgEl.length) {
            imageUrl = imgEl.attr('src') || '';
        }

        let imageSrc = '';
        if (imageUrl) {
            if (!imageUrl.startsWith('http')) {
                imageUrl = imageUrl.startsWith('/') ? `https://eventhubcc.vit.ac.in${imageUrl}` : `https://eventhubcc.vit.ac.in/EventHub/${imageUrl}`;
            }

            // Fetch the image as arrayBuffer since it requires the JSESSIONID cookie
            try {
                const imgRes = await fetch(imageUrl, {
                    method: 'GET',
                    headers: {
                        'Cookie': jsessionid,
                        'User-Agent': 'Mozilla/5.0'
                    }
                });
                
                if (imgRes.ok) {
                    const buffer = await imgRes.arrayBuffer();
                    const base64 = Buffer.from(buffer).toString('base64');
                    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
                    imageSrc = `data:${contentType};base64,${base64}`;
                }
            } catch (err) {
                console.error("Failed to fetch image as base64:", err);
            }
        }

        return NextResponse.json({
            eid,
            imageSrc,
            description,
            metaDetails
        }, { status: 200 });

    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
