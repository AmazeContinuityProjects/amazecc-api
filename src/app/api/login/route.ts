import { NextResponse } from "next/server";
import type { AxiosResponse } from "axios";
import { syncClubsBackground } from "@/lib/syncClubs";
import VTOPClient from "@/lib/clients/VTOPClient";
import { checkRateLimit, rateLimitResponse, getClientIp } from "@/lib/rateLimit";

import { getDbPool } from "@/lib/db";
import { signClubToken } from "@/lib/clubAuth";
import { getCaptcha } from "../login/captcha";
import { solveCaptcha } from "../login/solveCaptcha";
import * as cheerio from "cheerio";





/**
 * @openapi
 * /api/login:
 *   post:
 *     tags:
 *       - Login
 *     summary: POST endpoint for /api/login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
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

const VTOP_PHASE_BUDGET_MS = 50_000;
const VTOP_REQUEST_TIMEOUT_MS = 15_000;
const DB_LOOKUP_BUDGET_MS = 5_000;

class DeadlineError extends Error {}

function withDeadline<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new DeadlineError(message)), ms);
        work.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err: unknown) => {
                clearTimeout(timer);
                reject(err);
            }
        );
    });
}

export async function POST(req: Request) {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`login:${ip}`, 5, 60000);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    try {
        const {  username, password  } = await req.json().catch(()=>({}));
        const client = VTOPClient();

        const { allCookies, dashboardHtml } = await withDeadline(
            (async () => {
                const captchaRes = await getCaptcha();
                if("error" in captchaRes){
                    throw new Error(captchaRes.error);
                }

                const { captchaBase64, cookies, csrf } = captchaRes;
                const captcha = await solveCaptcha(captchaBase64);

                const loginRes = await client.post(
                    "/vtop/login",
                    new URLSearchParams({
                        _csrf: csrf,
                        username,
                        password,
                        captchaStr: captcha,
                    }).toString(),
                    {
                        headers: {
                            Cookie: cookies.join("; "),
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                        maxRedirects: 0,
                        validateStatus: (s) => s < 400 || s === 302,
                        timeout: VTOP_REQUEST_TIMEOUT_MS,
                    }
                );

                const loginCookies = loginRes.headers["set-cookie"];
                const allCookies = [...(cookies || []), ...(loginCookies || [])].join("; ");

                let dashboardRes: AxiosResponse;
                if (loginRes.status === 302 && loginRes.headers.location) {
                    dashboardRes = await client.get(loginRes.headers.location, {
                        headers: { Cookie: allCookies },
                        timeout: VTOP_REQUEST_TIMEOUT_MS,
                    });
                } else {
                    dashboardRes = await client.get("/vtop/open/page", {
                        headers: { Cookie: allCookies },
                        timeout: VTOP_REQUEST_TIMEOUT_MS,
                    });
                }

                return { allCookies, dashboardHtml: dashboardRes.data as string };
            })(),
            VTOP_PHASE_BUDGET_MS,
            `VTOP login did not complete within ${VTOP_PHASE_BUDGET_MS}ms`
        );

        let isAuthorized = false;

        if (/authorizedidx/i.test(dashboardHtml)) {
            isAuthorized = true;
        } else if (/invalid\s*captcha/i.test(dashboardHtml)) {
            return NextResponse.json({ success: false, message: "Invalid Captcha" }, { status: 401 });
        } else if (/invalid\s*(user\s*name|login\s*id|user\s*id)\s*\/\s*password/i.test(dashboardHtml)) {
            return NextResponse.json({ success: false, message: "Invalid Username / Password" }, { status: 401 });
        } else if (/months/i.test(dashboardHtml)) {
            return NextResponse.json({ success: false, message: "Please visit VTOP and change your password, it has expired after the usual 3 month period"})
        }

        if (!isAuthorized) {
            return NextResponse.json({
                success: false,
                message: "Login failed for an unknown reason.",
            }, { status: 401 });
        }

        const $ = cheerio.load(dashboardHtml);
        const new_csrf: string = String($('input[name="_csrf"]').val() ?? "");
        let authorizedID: string =
            (String($('#authorizedID').val() ?? "") || String($('input[name="authorizedid"]').val() ?? ""));

        if (!authorizedID) {
            authorizedID = username.toUpperCase();
        }

        // Spawn background sync for VTOP Clubs so we always have the latest active list
        syncClubsBackground(allCookies, new_csrf, authorizedID);

        // Check if user is a club representative
        let clubToken: string | undefined = undefined;
        let clubRoles: Array<{ club_id: string; role: string }> = [];
        try {
            const pool = getDbPool();
            const { rows } = await withDeadline(
                pool.query(
                    'SELECT club_id, role FROM club_representatives WHERE vtop_id = $1',
                    [authorizedID]
                ),
                DB_LOOKUP_BUDGET_MS,
                `club_representatives lookup exceeded ${DB_LOOKUP_BUDGET_MS}ms`
            );
            
            if (rows.length > 0) {
                // Deduplicate by club_id, prioritizing super-club-rep if duplicate rows exist
                const roleMap = new Map<string, { club_id: string; role: string }>();
                for (const r of rows) {
                    if (!r.club_id) continue;
                    const existing = roleMap.get(r.club_id);
                    if (!existing || r.role === 'super-club-rep') {
                        roleMap.set(r.club_id, r);
                    }
                }
                const uniqueRoles = Array.from(roleMap.values());

                // Issue a token containing all the clubs they represent. 
                // The frontend can pass 'x-club-id' header to select the club context dynamically.
                clubToken = signClubToken(authorizedID, uniqueRoles);
                clubRoles = uniqueRoles;
            }
        } catch (dbErr) {
            console.error("Failed to fetch club roles for login:", dbErr);
        }

        return NextResponse.json({
            success: true,
            message: "Login successful!",
            cookies: allCookies,
            csrf: new_csrf,
            authorizedID,
            clubToken, // Will be undefined if not a rep
            clubRoles, // Provide the roles they have
        }, { status: 200 });

    } catch (err: unknown) {
        console.error(err);
        if (err instanceof DeadlineError) {
            return NextResponse.json(
                { success: false, error: "VTOP did not respond in time. Please try again." },
                { status: 504 }
            );
        }
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : "Internal server error" },
            { status: 502 }
        );
    }
}


