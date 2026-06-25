import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import https from "https";
import querystring from "querystring";

const KOHA_HOST = "webopaccc.vit.ac.in";
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });

function kohaFetch(method: string, path: string, cookies: string, postData?: string): Promise<{ status: number; body: string; cookies: string }> {
  return new Promise((resolve, reject) => {
    const opts: https.RequestOptions = {
      hostname: KOHA_HOST,
      path: path.startsWith("http") ? new URL(path).pathname + new URL(path).search : path,
      method,
      agent,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AmazeCC/1.0)", Connection: "close" } as any,
    };
    if (cookies) (opts.headers as any)["Cookie"] = cookies;
    if (postData) {
      (opts.headers as any)["Content-Type"] = "application/x-www-form-urlencoded";
      (opts.headers as any)["Content-Length"] = Buffer.byteLength(postData);
    }
    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const setCookies = (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location.startsWith("http") ? res.headers.location : `/cgi-bin/koha/${res.headers.location}`;
          kohaFetch("GET", loc, setCookies || cookies).then(resolve).catch(reject);
        } else {
          resolve({ status: res.statusCode || 500, body: data, cookies: setCookies || cookies });
        }
      });
    });
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

const PAGE_MAP: Record<string, string> = {
  summary: "/cgi-bin/koha/opac-user.pl",
  charges: "/cgi-bin/koha/opac-account.pl",
  details: "/cgi-bin/koha/opac-memberentry.pl",
  tags: "/cgi-bin/koha/opac-tags.pl?mine=1",
  password: "/cgi-bin/koha/opac-passwd.pl",
  history: "/cgi-bin/koha/opac-search-history.pl",
  checkouts: "/cgi-bin/koha/opac-readingrecord.pl",
  suggestions: "/cgi-bin/koha/opac-suggestions.pl",
  messaging: "/cgi-bin/koha/opac-messaging.pl",
  lists: "/cgi-bin/koha/opac-shelves.pl?op=list",
};

function parsePage($: cheerio.CheerioAPI): any {
  const page: any = {};

  page.title = $("h1").first().text().trim() || $("title").text().trim();

  page.patronName = $(".userlabel").text().replace("Welcome,", "").trim() || "";

  const tables: any[] = [];
  $("table").each((_, el) => {
    const caption = $(el).find("caption").text().trim() || $(el).prev("h4, h5").text().trim() || "";
    const headers: string[] = [];
    const rows: any[] = [];
    $(el).find("thead th").each((_, th) => { headers.push($(th).text().trim()); });
    $(el).find("tbody tr").each((_, tr) => {
      const cells: string[] = [];
      $(tr).find("td").each((_, td) => { cells.push($(td).text().trim().replace(/\s+/g, " ")); });
      if (cells.length) rows.push(cells);
    });
    if (headers.length || rows.length) {
      tables.push({ caption, headers, rows });
    }
  });
  page.tables = tables;

  const alerts: string[] = [];
  $(".alert, .alert-info, .alert-warning").each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, " ");
    if (t && !t.includes("×")) alerts.push(t);
  });
  page.alerts = alerts;

  return page;
}

export async function POST(req: NextRequest) {
  try {
    const { card, password, page: pageName } = await req.json();

    if (!card || !password) {
      return NextResponse.json({ success: false, error: "Card number and password are required" }, { status: 400 });
    }

    const loginPage = await kohaFetch("GET", "/cgi-bin/koha/opac-user.pl", "");
    const postData = querystring.stringify({
      koha_login_context: "opac",
      userid: card,
      password,
    });
    const loginResult = await kohaFetch("POST", "/cgi-bin/koha/opac-user.pl", loginPage.cookies, postData);
    const cookies = loginResult.cookies || loginPage.cookies;

    if (loginResult.body.includes('auth_error') || (!loginResult.body.includes('logout') && !loginResult.body.includes('opac-user'))) {
      return NextResponse.json({ success: false, error: "Invalid card number or password" }, { status: 401 });
    }

    if (pageName && PAGE_MAP[pageName]) {
      const pageResult = await kohaFetch("GET", PAGE_MAP[pageName], cookies);
      const $ = cheerio.load(pageResult.body);
      return NextResponse.json({ success: true, page: pageName, data: parsePage($) });
    }

    const result: any = { loggedIn: true, patronName: "" };
    const $ = cheerio.load(loginResult.body);
    result.patronName = $(".userlabel").text().replace("Welcome,", "").trim() || "";

    const pages: any = {};
    for (const [key, url] of Object.entries(PAGE_MAP)) {
      const r = await kohaFetch("GET", url, cookies);
      const p$ = cheerio.load(r.body);
      pages[key] = parsePage(p$);
    }
    result.pages = pages;

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error("koha/patron error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
