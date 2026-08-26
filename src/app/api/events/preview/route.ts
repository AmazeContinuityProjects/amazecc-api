/**
 * @openapi
 * /api/events/preview:
 *   post:
 *     tags:
 *       - Events
 *     summary: Auto-generated POST endpoint for /api/events/preview
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eid:
 *                 type: string
 *               username:
 *                 type: string
 *               password:
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
import { getEventHubCookie } from "@/lib/eventHubAuth";

export async function POST(req: Request) {
    try {
        const { username, password, jsessionid, eid } = await req.json().catch(() => ({}));

        if (!eid) {
            return NextResponse.json({ error: "Missing eid" }, { status: 400 });
        }

        const cookie = await getEventHubCookie({ username, password, jsessionid });

        if (!cookie) {
            return NextResponse.json({ error: "Failed to authenticate with Event Hub. Invalid credentials?" }, { status: 401 });
        }

        // Fetch Event Preview
        const previewParams = new URLSearchParams({ eid: String(eid) });
        const previewRes = await fetch('https://eventhubcc.vit.ac.in/EventHub/eventPreview', {
            method: 'POST',
            body: previewParams,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookie,
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
                        'Cookie': cookie,
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

    } catch (err: unknown) {
        console.error(err);
        return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) || "Internal server error" }, { status: 500 });
    }
}
