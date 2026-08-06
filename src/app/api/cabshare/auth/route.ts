import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { getCaptcha } from "../../login/captcha";
import { solveCaptcha } from "../../login/solveCaptcha";
import { getDbPool } from "@/lib/db";
import * as cheerio from "cheerio";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { username, password, phone_number } = body;

        if (!username || !password || !phone_number) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        // 1. Authenticate with VTOP to verify identity
        const captchaRes = await getCaptcha();
        if ("error" in captchaRes) {
            return NextResponse.json({ success: false, error: captchaRes.error }, { status: 500 });
        }

        const { captchaBase64, cookies, csrf } = captchaRes;
        const captcha = await solveCaptcha(captchaBase64);
        const client = VTOPClient();

        const loginRes = await client.post(
            "/vtop/login",
            new URLSearchParams({ _csrf: csrf, username, password, captchaStr: captcha }).toString(),
            {
                headers: { Cookie: cookies.join("; "), "Content-Type": "application/x-www-form-urlencoded" },
                maxRedirects: 0,
                validateStatus: (s) => s < 400 || s === 302,
            }
        );

        const loginCookies = loginRes.headers["set-cookie"];
        const allCookies = [...(cookies || []), ...(loginCookies || [])].join("; ");

        // Handle 302 Redirect for Dashboard
        let dashboardRes: any;
        if (loginRes.status === 302 && loginRes.headers.location) {
            dashboardRes = await client.get(loginRes.headers.location, { headers: { Cookie: allCookies } });
        } else {
            dashboardRes = await client.get("/vtop/open/page", { headers: { Cookie: allCookies } });
        }

        if (!/authorizedidx/i.test(dashboardRes.data)) {
            return NextResponse.json({ success: false, message: "Invalid Username / Password" }, { status: 401 });
        }

        const $dash = cheerio.load(dashboardRes.data);
        const new_csrf = $dash('input[name="_csrf"]').val() as string;
        const authorizedID = $dash('#authorizedID').val() || $dash('input[name="authorizedid"]').val() || username.toUpperCase();

        // 2. Fetch Profile to get Name
        const profileRes = await client.post(
            "/vtop/studentsRecord/StudentProfileAllView",
            new URLSearchParams({ verifyMenu: "true", authorizedID, _csrf: new_csrf, nocache: Date.now().toString() }).toString(),
            {
                headers: {
                    Cookie: allCookies,
                    "Content-Type": "application/x-www-form-urlencoded",
                    Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
                },
            }
        );

        const $prof = cheerio.load(profileRes.data);
        let name = "";
        $prof("table tr").each((_, row) => {
            const cols = $prof(row).find("td");
            if (cols.length >= 2) {
                const label = cols.eq(0).text().trim().toUpperCase();
                if (label.includes("STUDENT NAME")) {
                    name = cols.eq(1).text().trim();
                }
            }
        });

        if (!name) name = "Student"; // Fallback

        // 3. Upsert into database
        const pool = getDbPool();
        const upsertQuery = `
            INSERT INTO cabshare_users (name, phone_number, reg_number)
            VALUES ($1, $2, $3)
            ON CONFLICT (reg_number) 
            DO UPDATE SET name = EXCLUDED.name, phone_number = EXCLUDED.phone_number, updated_at = NOW()
            RETURNING user_id, name, phone_number, reg_number
        `;
        const { rows } = await pool.query(upsertQuery, [name, phone_number, authorizedID]);

        return NextResponse.json({
            success: true,
            user: rows[0],
            // In a real app we'd sign a JWT here. For this implementation, the frontend will pass reg_number as auth.
        });

    } catch (err: any) {
        console.error("CabShare Auth Error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
