/**
 * @openapi
 * /api/events/download:
 *   post:
 *     tags:
 *       - Events
 *     summary: Auto-generated POST endpoint for /api/events/download
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
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
import { getEventHubCookie } from "@/lib/eventHubAuth";

export async function POST(req: Request) {
    try {
        const { username, password, jsessionid, url } = await req.json().catch(() => ({}));

        if (!username && !jsessionid) {
            return NextResponse.json({ error: "Missing username or jsessionid" }, { status: 400 });
        }
        if (!url) {
            return NextResponse.json({ error: "Missing url" }, { status: 400 });
        }

        const cookie = await getEventHubCookie({ username, password, jsessionid });

        if (!cookie) {
            return NextResponse.json({ error: "Failed to authenticate with Event Hub." }, { status: 401 });
        }

        // Fetch the file
        const fileUrl = url.startsWith('http') ? url : `https://eventhubcc.vit.ac.in${url.startsWith('/') ? url : '/' + url}`;
        const fileRes = await fetch(fileUrl, {
            headers: { 'Cookie': cookie, 'User-Agent': 'Mozilla/5.0' },
            redirect: 'follow'
        });
        
        if (!fileRes.ok) {
            return NextResponse.json({ error: `Failed to download file from Event Hub. Status: ${fileRes.status}` }, { status: 500 });
        }

        const contentType = fileRes.headers.get("content-type") || "application/pdf";
        let contentDisposition = fileRes.headers.get("content-disposition");
        
        if (!contentDisposition) {
            const isCert = url.toLowerCase().includes('certificate');
            contentDisposition = `attachment; filename="${isCert ? 'Certificate' : 'Receipt'}.pdf"`;
        }

        // Stream the file directly to the client without buffering in memory
        return new NextResponse(fileRes.body as unknown as BodyInit, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": contentDisposition
            }
        });

    } catch (error: unknown) {
        console.error("Download Proxy Error:", error);
        return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || "Internal server error" }, { status: 500 });
    }
}
