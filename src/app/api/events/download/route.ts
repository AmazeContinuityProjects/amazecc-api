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

export async function POST(req: Request) {
    try {
        const { username, password, url } = await req.json().catch(() => ({}));

        if (!username || !password || !url) {
            return NextResponse.json({ error: "Missing username, password, or url" }, { status: 400 });
        }

        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

        // Step 1: Login
        const loginParams = new URLSearchParams({
            username: username,
            password: password,
            validateVitian: "1"
        });

        const loginRes = await fetch('https://eventhubcc.vit.ac.in/EventHub/mainDashboard', {
            method: 'POST',
            body: loginParams,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
            redirect: 'manual'
        });

        const setCookieHeader = loginRes.headers.get('set-cookie');
        let jsessionid = '';
        if (setCookieHeader) {
            const match = setCookieHeader.match(/JSESSIONID=([^;]+)/);
            if (match) jsessionid = `JSESSIONID=${match[1]}`;
        }

        if (!jsessionid) {
            return NextResponse.json({ error: "Failed to authenticate with Event Hub." }, { status: 401 });
        }

        // Step 2: Fetch the file
        const fileUrl = url.startsWith('http') ? url : `https://eventhubcc.vit.ac.in${url.startsWith('/') ? url : '/' + url}`;
        const fileRes = await fetch(fileUrl, {
            headers: { 'Cookie': jsessionid, 'User-Agent': 'Mozilla/5.0' },
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
        return new NextResponse(fileRes.body as any, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": contentDisposition
            }
        });

    } catch (error: any) {
        console.error("Download Proxy Error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
