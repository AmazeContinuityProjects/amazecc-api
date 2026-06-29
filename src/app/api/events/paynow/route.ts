/**
 * @openapi
 * /api/events/paynow:
 *   post:
 *     tags:
 *       - Events
 *     summary: Auto-generated POST endpoint for /api/events/paynow
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
import * as cheerio from "cheerio";

export async function POST(req: Request) {
    try {
        const { username, password, url } = await req.json().catch(() => ({}));

        if (!username || !password || !url) {
            return NextResponse.json({ error: "Missing username, password, or url" }, { status: 400 });
        }

        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

        const tcUrl = url.startsWith('http') ? url : `https://eventhubcc.vit.ac.in${url.startsWith('/') ? url : '/' + url}`;

        // Instead of fetching and parsing the T&C page, we generate an HTML page 
        // that logs the user into Event Hub via a hidden iframe, then redirects to the T&C page.
        const htmlPayload = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Redirecting to Event Hub...</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #334155; }
                .loader { border: 3px solid #e2e8f0; border-top: 3px solid #3b82f6; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin-right: 12px; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .container { display: flex; align-items: center; background: white; padding: 20px 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="loader"></div>
                <p>Authenticating securely with Event Hub...</p>
            </div>
            
            <form id="loginForm" action="https://eventhubcc.vit.ac.in/EventHub/mainDashboard" method="POST">
                <input type="hidden" name="username" value="${username.replace(/"/g, '&quot;')}" />
                <input type="hidden" name="password" value="${password.replace(/"/g, '&quot;')}" />
                <input type="hidden" name="validateVitian" value="1" />
            </form>
            
            <script>
                // Submit the login form as a top-level navigation to bypass Safari ITP
                document.getElementById("loginForm").submit();
            </script>
        </body>
        </html>
        `;

        return NextResponse.json({ status: "payment_form", html: htmlPayload, tcUrl: tcUrl }, { status: 200 });

    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
