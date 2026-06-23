import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

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

        // Step 2: Fetch the provided PayNow URL (which is usually the T&C page)
        const tcUrl = url.startsWith('http') ? url : `https://eventhubcc.vit.ac.in${url.startsWith('/') ? url : '/' + url}`;
        const tcRes = await fetch(tcUrl, {
            headers: { 'Cookie': jsessionid, 'User-Agent': 'Mozilla/5.0' },
            redirect: 'manual'
        });
        
        const status = tcRes.status;
        let finalHtml = await tcRes.text();
        
        // If it's the T&C page, we submit it
        const $tc = cheerio.load(finalHtml);
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
            
            if (finalPayRes.status === 200 || finalPayRes.status === 302 || finalPayRes.status === 303) {
                if (finalPayRes.status === 200) {
                    finalHtml = await finalPayRes.text();
                } else {
                    const loc = finalPayRes.headers.get('location') || '';
                    if (loc) {
                        const finalUrl = loc.startsWith('http') ? loc : `https://eventhubcc.vit.ac.in${loc.startsWith('/') ? loc : '/' + loc}`;
                        return NextResponse.json({ status: "payment_required", url: finalUrl }, { status: 200 });
                    }
                }
            }
        }
        
        // Check if the response is actually the BillDesk form or similar
        const bodyLower = finalHtml.toLowerCase();
        const $body = cheerio.load(finalHtml);
        const externalForms = $body('form').filter((_, el) => {
            const action = $body(el).attr('action') || '';
            return action.startsWith('http') && !action.includes('eventhubcc.vit.ac.in');
        });

        if (
            externalForms.length > 0 ||
            bodyLower.includes("billdesk") || 
            bodyLower.includes("paytm") || 
            bodyLower.includes("razorpay") || 
            finalHtml.includes('name="msg"')
        ) {
            const modifiedHtml = finalHtml.replace('<head>', '<head><base href="https://eventhubcc.vit.ac.in/">');
            const baseInjected = modifiedHtml.includes('<base') ? modifiedHtml : `<base href="https://eventhubcc.vit.ac.in/">\n${finalHtml}`;
            return NextResponse.json({ status: "payment_form", html: baseInjected }, { status: 200 });
        }
        
        // If nothing matched, just return the raw HTML or a success message
        return NextResponse.json({ status: "success", message: "Processed payment link but no payment gateway form was found. You might have already paid or the event is free." }, { status: 200 });

    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
