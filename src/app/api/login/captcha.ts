import { CaptchaResult, CaptchaType } from "@/types/data/login";
import VTOPClient from "@/lib/clients/VTOPClient";
import * as cheerio from "cheerio";

const MAX_RETRIES = 10;
const DEADLINE_MS = 20_000;
const REQUEST_TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 500;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function getCaptcha(): Promise<CaptchaResult> {
    const client = VTOPClient();
    const startedAt = Date.now();
    let lastError = "unknown error";

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const remaining = DEADLINE_MS - (Date.now() - startedAt);
        if (remaining <= 0) {
            return {
                error: `Timed out after ${DEADLINE_MS}ms while fetching captcha. Last error: ${lastError}`
            };
        }
        const budget = Math.max(1, Math.min(REQUEST_TIMEOUT_MS, remaining));

        try {
            const setupRes = await client.get("/vtop/prelogin/setup", { timeout: budget });
            const cookies: string[] = (setupRes.headers["set-cookie"] as unknown as string[]) || [];
            const $ = cheerio.load(setupRes.data);

            const csrfValue = $("#stdForm input[name=_csrf]").val();
            const csrf = Array.isArray(csrfValue) ? csrfValue[0] : csrfValue;

            if (!csrf) {
                lastError = "csrf token missing from /vtop/prelogin/setup";
                await sleep(RETRY_DELAY_MS);
                continue;
            }

            await client.post(
                "/vtop/prelogin/setup",
                new URLSearchParams({ _csrf: csrf, flag: "VTOP" }).toString(),
                {
                    headers: {
                        Cookie: (cookies as string[]).join("; "),
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    timeout: budget,
                }
            );

            const loginPage = await client.get("/vtop/login", {
                headers: { Cookie: (cookies as string[]).join("; ") },
                timeout: budget,
            });

            const $$ = cheerio.load(loginPage.data);

            const captchaType: CaptchaType =
                $$('input#gResponse').length === 1 ? "GRECAPTCHA" : "DEFAULT";

            if (captchaType === "GRECAPTCHA") {
                lastError = "VTOP served a reCAPTCHA challenge to this server IP";
                await sleep(RETRY_DELAY_MS);
                continue;
            }

            const imgSrc = $$("#captchaBlock img").attr("src");
            if (!imgSrc) {
                lastError = "Captcha image source not found on /vtop/login";
                await sleep(RETRY_DELAY_MS);
                continue;
            }

            let base64: string;

            if (imgSrc.startsWith("data:image")) {
                base64 = imgSrc;
            } else {
                const imgRes = await client.get(imgSrc, {
                    responseType: "arraybuffer",
                    headers: { Cookie: (cookies as string[]).join("; ") },
                    timeout: budget,
                });

                base64 =
                    "data:image/jpeg;base64," +
                    Buffer.from(imgRes.data, "binary").toString("base64");
            }

            return { captchaBase64: base64, cookies, csrf };
        } catch (err: unknown) {
            lastError = err instanceof Error ? err.message : String(err);
            await sleep(RETRY_DELAY_MS);
        }
    }

    return {
        error: `Failed to get a DEFAULT captcha after ${MAX_RETRIES} attempts. Last error: ${lastError}`
    };
}
