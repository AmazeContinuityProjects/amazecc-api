import { NextResponse } from "next/server";

function looksLikeLoginPage(html: string): boolean {
  return /action=["']\/EventHub\/mainDashboard["']/i.test(html);
}

function extractCookies(headers: Headers): string {
  const raw: string[] =
    typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : (headers.get("set-cookie")?.split(/,(?=[^;]+=[^;]+;)/) ?? []);
  let j: string | null = null;
  let c: string | null = null;
  for (const cookie of raw) {
    const jm = cookie.match(/JSESSIONID=([^;,\s]+)/);
    if (jm) j = jm[1];
    const cm = cookie.match(/cookiesession1=([^;,\s]+)/);
    if (cm) c = cm[1];
  }
  if (!j) return "";
  return c ? `${j}; cookiesession1=${c}` : j;
}

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const loginParams = new URLSearchParams({ username, password, validateVitian: "1" });
    const loginRes = await fetch("https://eventhubcc.vit.ac.in/EventHub/mainDashboard", {
      method: "POST",
      body: loginParams,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
      },
      redirect: "manual",
    });

    const setCookieHeader = loginRes.headers.get("set-cookie");
    void setCookieHeader;
    const jsessionid = extractCookies(loginRes.headers);

    if (!jsessionid) {
      return NextResponse.json(
        { success: false, error: "Failed to authenticate with Event Hub. Please check your credentials." },
        { status: 401 },
      );
    }

    // EventHub returns HTTP 200 + Set-Cookie even for bad credentials, so the
    // cookie alone proves nothing. A failed login re-renders the login form.
    const loginHtml = await loginRes.text();
    if (looksLikeLoginPage(loginHtml)) {
      return NextResponse.json(
        { success: false, error: "Failed to authenticate with Event Hub. Please check your credentials." },
        { status: 401 },
      );
    }

    return NextResponse.json({ success: true, jsessionid }, { status: 200 });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) || "Internal server error" }, { status: 500 });
  }
}
