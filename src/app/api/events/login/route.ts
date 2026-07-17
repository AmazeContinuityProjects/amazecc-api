import { NextResponse } from "next/server";

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
    let jsessionid = "";
    if (setCookieHeader) {
      const jmatch = setCookieHeader.match(/JSESSIONID=([^;,\s]+)/);
      const cmatch = setCookieHeader.match(/cookiesession1=([^;,\s]+)/);
      if (jmatch) {
        jsessionid = jmatch[1];
        if (cmatch) {
          jsessionid += `; cookiesession1=${cmatch[1]}`;
        }
      }
    }

    if (!jsessionid) {
      return NextResponse.json(
        { success: false, error: "Failed to authenticate with Event Hub. Please check your credentials." },
        { status: 401 },
      );
    }

    return NextResponse.json({ success: true, jsessionid }, { status: 200 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message || "Internal server error" }, { status: 500 });
  }
}
