import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET() {
    try {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        const response = await fetch('https://eventhubcc.vit.ac.in/EventHub/', {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load Event Hub: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const extractedEvents: any[] = [];

        $('#events .card').each((i, card) => {
            const $card = $(card);
            const title = $card.find('.card-title span').first().text().trim();
            const eid = $card.find('button[name="eid"]').attr('value') || '';

            if (!title || !eid) return;

            let eligibility = '';
            let type = '';
            let date = '';
            let location = '';
            let price = '';
            let posterUrl = '';

            // Extract poster image: search raw card HTML for any image URL pattern
            const cardInner = $card.html() || '';
            const cardOuter = $.html($card) || $('<div>').append($card.clone()).html() || cardInner;
            const searchHtml = cardOuter + cardInner;

            const imgSrcMatch = searchHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
            if (imgSrcMatch) posterUrl = imgSrcMatch[1];

            if (!posterUrl) {
                const bgMatch = searchHtml.match(/background(?:-image)?\s*:\s*url\(['"]?([^'")]+)['"]?\)/i);
                if (bgMatch) posterUrl = bgMatch[1];
            }

            if (posterUrl && !posterUrl.startsWith('http') && !posterUrl.startsWith('data:')) {
                posterUrl = posterUrl.startsWith('/')
                    ? `https://eventhubcc.vit.ac.in${posterUrl}`
                    : `https://eventhubcc.vit.ac.in/EventHub/${posterUrl}`;
            }

            $card.find('div').each((j, div) => {
                const divHtml = $(div).html() || '';
                const text = $(div).text().trim();

                if (divHtml.includes('fa-people-carry-box') || divHtml.includes('fa-user-large')) {
                    eligibility = text;
                } else if (text.startsWith('(') && text.endsWith(')')) {
                    type = text.replace('(', '').replace(')', '');
                } else if (divHtml.includes('fa-calendar-days')) {
                    date = text;
                } else if (divHtml.includes('fa-map-location-dot')) {
                    location = text;
                } else if (divHtml.includes('fa-indian-rupee-sign')) {
                    price = text;
                }
            });

            extractedEvents.push({
                eid,
                title,
                eligibility,
                type,
                date,
                location,
                price,
                posterUrl
            });
        });

        return NextResponse.json(extractedEvents, { status: 200 });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
