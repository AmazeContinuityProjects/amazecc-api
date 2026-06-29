/**
 * @openapi
 * /api/events/register:
 *   post:
 *     tags:
 *       - Events
 *     summary: Auto-generated POST endpoint for /api/events/register
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

export async function POST(req: Request) {
    try {
        const { username, password, eid } = await req.json().catch(() => ({}));

        if (!username || !password || !eid) {
            return NextResponse.json({ error: "Missing username, password, or eid" }, { status: 400 });
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
            return NextResponse.json({ error: "Failed to authenticate with Event Hub. Invalid credentials?" }, { status: 401 });
        }

        // Step 2: Fetch Event Preview to grab hidden tokens
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

        const html = await previewRes.text();
        const $ = cheerio.load(html);

        // If the preview page has a login form, our login failed
        if ($('form[action="/EventHub/mainDashboard"]').length > 0) {
            return NextResponse.json({ error: "Event Hub authentication failed. Please check your credentials." }, { status: 401 });
        }

        // Check if Already Registered (the Register button disappears)
        const registerButton = $('form[method="POST"] button[formaction="/EventHub/registerEvent"], form[method="POST"] button:contains("Register")');
        if (registerButton.length === 0) {
             return NextResponse.json({ status: "already_registered", message: "You have already registered for this event, or registrations are closed." }, { status: 200 });
        }

        // Step 3: Extract ALL hidden tokens from the form
        const registerParams = new URLSearchParams();
        $('form[method="POST"] input').each((_, el) => {
            const name = $(el).attr('name');
            const value = $(el).val()?.toString() || '';
            if (name) {
                registerParams.append(name, value);
            }
        });

        // Add the button's payload (id=eid)
        registerParams.append('id', String(eid));

        // Step 4: Submit Registration
        const registerRes = await fetch('https://eventhubcc.vit.ac.in/EventHub/registerEvent', {
            method: 'POST',
            body: registerParams,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': jsessionid,
                'User-Agent': 'Mozilla/5.0',
                'Origin': 'https://eventhubcc.vit.ac.in',
                'Referer': 'https://eventhubcc.vit.ac.in/EventHub/eventPreview'
            },
            redirect: 'manual'
        });

        const status = registerRes.status;
        const location = registerRes.headers.get('location') || '';

        // Determine outcome
        if (status === 302 || status === 303) {
            
            if (location.includes("showPaymentTC")) {
                // The user is redirected to the Terms and Conditions page. 
                // Since the frontend browser doesn't have the JSESSIONID, they can't submit the form there.
                // We must fetch it, agree to T&C, and submit it to get the final BillDesk payload!
                const tcUrl = location.startsWith('http') ? location : `https://eventhubcc.vit.ac.in${location.startsWith('/') ? location : '/' + location}`;
                const tcRes = await fetch(tcUrl, {
                    headers: { 'Cookie': jsessionid },
                    redirect: 'manual'
                });
                
                const tcHtml = await tcRes.text();
                const $tc = cheerio.load(tcHtml);
                const tcFormAction = $tc('form').attr('action');
                
                if (tcFormAction && tcFormAction.includes('doPtmPayment')) {
                    const payData = new URLSearchParams();
                    $tc('form input').each((_, el) => {
                        const name = $tc(el).attr('name');
                        if (name) payData.append(name, $tc(el).val()?.toString() || '');
                    });
                    
                    // Emulate checking the T&C checkbox
                    if (!payData.has('checkbox')) payData.append('checkbox', 'on');
                    
                    const payUrl = tcFormAction.startsWith('http') ? tcFormAction : `https://eventhubcc.vit.ac.in${tcFormAction.startsWith('/') ? tcFormAction : '/' + tcFormAction}`;
                    
                    const finalPayRes = await fetch(payUrl, {
                        method: 'POST',
                        body: payData,
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Cookie': jsessionid,
                            'Origin': 'https://eventhubcc.vit.ac.in',
                            'Referer': tcUrl
                        },
                        redirect: 'manual'
                    });
                    
                    if (finalPayRes.status === 200) {
                        const finalHtml = await finalPayRes.text();
                        const baseInjected = finalHtml.includes('<base') ? finalHtml : `<base href="https://eventhubcc.vit.ac.in/">\n${finalHtml}`;
                        return NextResponse.json({ status: "payment_form", html: baseInjected }, { status: 200 });
                    }
                }
            }

            // It could be a redirect to payment, or success page
            if (location.includes("payment") || location.includes("billdesk") || location.includes("paytm") || location.includes("razorpay")) {
                const finalUrl = location.startsWith('http') ? location : `https://eventhubcc.vit.ac.in${location.startsWith('/') ? location : '/' + location}`;
                return NextResponse.json({ status: "payment_required", url: finalUrl }, { status: 200 });
            } else if (location.includes("success") || location.includes("goBackToEventList")) {
                return NextResponse.json({ status: "success", message: "Successfully registered!" }, { status: 200 });
            }
            // Generic fallback
            const fallbackUrl = location.startsWith('http') ? location : `https://eventhubcc.vit.ac.in${location.startsWith('/') ? location : '/' + location}`;
            return NextResponse.json({ status: "redirect", url: fallbackUrl }, { status: 200 });
        } else if (status === 200) {
            // Rendered a page directly. It might be an auto-submitting payment form, or success/error text.
            const bodyText = await registerRes.text();
            const bodyLower = bodyText.toLowerCase();
            
            // Look for any external form or known payment keywords
            const $body = cheerio.load(bodyText);
            const externalForms = $body('form').filter((_, el) => {
                const action = $body(el).attr('action') || '';
                return action.startsWith('http') && !action.includes('eventhubcc.vit.ac.in');
            });

            if (
                externalForms.length > 0 ||
                bodyLower.includes("billdesk") || 
                bodyLower.includes("paytm") || 
                bodyLower.includes("razorpay") || 
                bodyLower.includes("pay") || 
                bodyLower.includes("payment") || 
                bodyText.includes('name="msg"') ||
                bodyText.includes('name="merchant_id"')
            ) {
                // Inject a <base> tag so relative forms submit to Event Hub, not localhost!
                const modifiedHtml = bodyText.replace('<head>', '<head><base href="https://eventhubcc.vit.ac.in/">');
                // If there's no <head>, we can prepend it
                const finalHtml = modifiedHtml.includes('<base') ? modifiedHtml : `<base href="https://eventhubcc.vit.ac.in/">\n${bodyText}`;

                return NextResponse.json({ status: "payment_form", html: finalHtml }, { status: 200 });
            }

            // Fallback success
            return NextResponse.json({ status: "success", message: "Successfully registered!" }, { status: 200 });
        } else {
            // Bad request or Server Error
            return NextResponse.json({ error: `Registration failed with status ${status}` }, { status: 400 });
        }

    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
