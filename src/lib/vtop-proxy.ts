import type { AxiosInstance } from "axios";
import { URLSearchParams } from "url";
import * as cheerio from "cheerio";
import VTOPClient from "@/lib/clients/VTOPClient";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";
import { parseBankInfo } from "@/lib/parsers/bank-info";
import { parseDayboarder } from "@/lib/parsers/dayboarder";
import { parseWallet } from "@/lib/parsers/wallet";
import { parseCredentials } from "@/lib/parsers/credentials";
import { parsePayments } from "@/lib/parsers/payments";
import { parsePaymentReceipts } from "@/lib/parsers/payment-receipts";
import { parseAcknowledgement } from "@/lib/parsers/acknowledgement";

/**
 * Shared VTOP proxy implementations.
 *
 * Every endpoint here is the same shape: one POST to a VTOP page, then a parser
 * turns the HTML into JSON. They used to live as ~13 near-identical route files,
 * each costing a separate function invocation on every sync. This registry is the
 * single source of truth — the individual routes are now thin wrappers around it
 * (so the Kotlin app and any other consumer keeps working), and `/api/bulk` runs
 * any subset of them inside one invocation.
 */

export interface ProxyCreds {
  cookies?: string | string[];
  authorizedID?: string;
  csrf?: string;
}

export interface ProxyOutcome {
  status: number;
  body: Record<string, unknown>;
}

const REFERER = "https://vtopcc.vit.ac.in/vtop/open/page";

function cookieHeader(creds: ProxyCreds): string {
  return Array.isArray(creds.cookies) ? creds.cookies.join("; ") : (creds.cookies ?? "");
}

/** One VTOP POST with the params every menu-scoped page expects. */
async function post(
  client: AxiosInstance,
  url: string,
  creds: ProxyCreds,
  extra: Record<string, string> = {}
): Promise<string> {
  const resp = await client.post(
    url,
    new URLSearchParams({
      verifyMenu: "true",
      authorizedID: String(creds.authorizedID),
      _csrf: String(creds.csrf),
      nocache: Date.now().toString(),
      ...extra,
    }).toString(),
    {
      headers: {
        Cookie: cookieHeader(creds),
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: REFERER,
      },
    }
  );
  return resp.data;
}

/**
 * The semester-iterating pages (EXC registration, course completion): read the
 * init page, discover the semester `<select>`, then re-post once per semester.
 */
async function runSemesterProxy(
  client: AxiosInstance,
  initUrl: string,
  creds: ProxyCreds
): Promise<Record<string, unknown>> {
  const initResp = await post(client, initUrl, creds);
  const $ = cheerio.load(initResp);

  let semFieldName = "semesterSubId";
  $("select").each((_, el) => {
    const name = $(el).attr("name") || $(el).attr("id") || "";
    let hasSem = false;
    $(el).find("option").each((__, o) => {
      const t = $(o).text().trim().toLowerCase();
      if (t.includes("sem") || t.includes("fall") || t.includes("winter") || t.includes("summer")) hasSem = true;
    });
    if (hasSem && name) semFieldName = name;
  });

  const options: { value: string; text: string }[] = [];
  $(`select[name="${semFieldName}"] option, select[id="${semFieldName}"] option`).each((_, el) => {
    const v = $(el).attr("value");
    if (v && v !== "null" && v !== "") options.push({ value: v, text: $(el).text().trim() });
  });

  const semesters: Record<string, unknown> = {};
  for (const opt of options) {
    try {
      const dataResp = await client.post(
        initUrl,
        new URLSearchParams({
          authorizedID: String(creds.authorizedID),
          x: new Date().toUTCString(),
          [semFieldName]: opt.value,
          _csrf: String(creds.csrf),
        }).toString(),
        {
          headers: {
            Cookie: cookieHeader(creds),
            "Content-Type": "application/x-www-form-urlencoded",
            Referer: REFERER,
          },
        }
      );
      semesters[opt.text] = { ...parseVtopHtml(dataResp.data) };
    } catch (e: unknown) {
      semesters[opt.text] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { semesters };
}

type ProxyFn = (client: AxiosInstance, creds: ProxyCreds) => Promise<unknown>;

export const VTOP_PROXIES: Record<string, ProxyFn> = {
  "bank-info": async (c, creds) => parseBankInfo(await post(c, "/vtop/studentBankInformation/BankInfoStudent", creds)),
  "dayboarder": async (c, creds) => parseDayboarder(await post(c, "/vtop/admissions/dayboarderForMenu", creds)),
  "wallet": async (c, creds) => parseWallet(await post(c, "/vtop/finance/getStudentWallet", creds)),
  "credentials": async (c, creds) => parseCredentials(await post(c, "/vtop/proctor/viewStudentCredentials", creds)),
  "payments": async (c, creds) => parsePayments(await post(c, "/vtop/p2p/Payments", creds)),
  "payment-receipts": async (c, creds) => parsePaymentReceipts(await post(c, "/vtop/p2p/getReceiptsApplno", creds)),
  "library-due": async (c, creds) => parseVtopHtml(await post(c, "/vtop/finance/libraryPayments", creds)),
  "hostel-counselling": async (c, creds) => parseVtopHtml(await post(c, "/vtop/examinations/technoCrendentials", creds)),
  "registration-schedule": async (c, creds) => parseVtopHtml(await post(c, "/vtop/examinations/hostelDetails", creds)),
  "ept-schedule": async (c, creds) => parseVtopHtml(await post(c, "/vtop/compre/eptScheduleShow", creds)),
  "acknowledgement": async (c, creds) => parseAcknowledgement(await post(c, "/vtop/admissions/AcknowledgmentView", creds)),
  "exc-registration": (c, creds) => runSemesterProxy(c, "/vtop/academics/exc/studentRegistration", creds),
  "course-completion": (c, creds) => runSemesterProxy(c, "/vtop/others/bonafide/CourseCompleteControl", creds),
};

export const VTOP_PROXY_NAMES: readonly string[] = Object.keys(VTOP_PROXIES);

/**
 * Run one proxy by name. Never throws: a failure comes back as
 * `{ success: false, error }` with a 500 so one bad endpoint cannot fail the batch.
 */
export async function runVtopProxy(name: string, creds: ProxyCreds): Promise<ProxyOutcome> {
  const fn = VTOP_PROXIES[name];
  if (!fn) return { status: 404, body: { success: false, error: `Unknown endpoint: ${name}` } };
  if (!creds.csrf || !creds.authorizedID) {
    return { status: 400, body: { error: "Missing csrf or authorizedID" } };
  }
  try {
    const data = (await fn(VTOPClient(), creds)) as Record<string, unknown>;
    return { status: 200, body: { success: true, ...data } };
  } catch (err: unknown) {
    console.error(`${name} error:`, err);
    return {
      status: 500,
      body: { success: false, error: err instanceof Error ? err.message : String(err) },
    };
  }
}
