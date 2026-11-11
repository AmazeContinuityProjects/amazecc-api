import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import { parseStudentProfile } from "@/lib/parsers/student-profile";
import { parseProctor } from "@/lib/parsers/proctor";
import { parseHodDean } from "@/lib/parsers/hod-dean";
import { parseCredentials } from "@/lib/parsers/credentials";
import { parseContact } from "@/lib/parsers/contact";
import { parseAcknowledgement } from "@/lib/parsers/acknowledgement";
import { parseDayboarder } from "@/lib/parsers/dayboarder";
import { parseBankInfo } from "@/lib/parsers/bank-info";
import { parseVtopHtml, type ParsedVtopPage } from "@/lib/parsers/auto-parse";
import { buildIdentity } from "@/lib/identity";
import { publicErrorMessage } from "@/lib/publicError";

const REFERER = "https://vtopcc.vit.ac.in/vtop/open/page";
const BASE_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  Referer: REFERER,
} as const;

function formParams(authorizedID: string, csrf: string, extra: Record<string, string> = {}): string {
  return new URLSearchParams({
    verifyMenu: "true",
    authorizedID,
    _csrf: csrf,
    nocache: Date.now().toString(),
    ...extra,
  }).toString();
}

function clean(value: unknown): string | undefined {
  const v = String(value ?? "").replace(/\s+/g, " ").trim();
  return v || undefined;
}

function cleanParsedPage(parsed: ParsedVtopPage) {
  const selectOptions: Record<string, { value: string; text: string; selected: boolean }[]> = {};
  for (const [k, opts] of Object.entries(parsed.selectOptions || {})) {
    const cleaned = (opts || [])
      .map((o) => ({ value: clean(o.value) || "", text: clean(o.text) || "", selected: !!o.selected }))
      .filter((o) => o.value || o.text);
    if (cleaned.length) selectOptions[k] = cleaned;
  }
  const tables = (parsed.tables || [])
    .map((t) => {
      const rows = (t.rows || [])
        .map((row) => {
          const out: Record<string, string> = {};
          for (const [k, v] of Object.entries(row || {})) {
            const c = clean(v);
            if (c) out[String(k).trim()] = c;
          }
          return out;
        })
        .filter((r) => Object.keys(r).length > 0);
      if (!rows.length) return null;
      const headers = (t.headers || []).map((h) => String(h).trim()).filter(Boolean);
      return {
        ...(clean(t.caption) ? { caption: clean(t.caption) } : {}),
        ...(headers.length ? { headers } : {}),
        rows,
      };
    })
    .filter(Boolean);
  const keyValuePairs: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.keyValuePairs || {})) {
    const c = clean(v);
    if (c) keyValuePairs[k] = c;
  }
  const formFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.formFields || {})) {
    const c = clean(v);
    if (c) formFields[k] = c;
  }
  const messages: Record<string, string> = {};
  if (clean(parsed.messages?.warning)) messages.warning = clean(parsed.messages.warning)!;
  if (clean(parsed.messages?.error)) messages.error = clean(parsed.messages.error)!;
  if (clean(parsed.messages?.success)) messages.success = clean(parsed.messages.success)!;

  return {
    ...(clean(parsed.title) ? { title: clean(parsed.title) } : {}),
    ...(Object.keys(selectOptions).length ? { selectOptions } : {}),
    ...(tables.length ? { tables } : {}),
    ...(Object.keys(keyValuePairs).length ? { keyValuePairs } : {}),
    ...(Object.keys(formFields).length ? { formFields } : {}),
    ...(Object.keys(messages).length ? { messages } : {}),
  };
}

function cleanDayboarder(data: ReturnType<typeof parseDayboarder>) {
  const fields: Record<string, { label: string; value: string }> = {};
  for (const [k, v] of Object.entries(data.fields || {})) {
    if (k === "_csrf" || k === "authorizedID") continue;
    const value = clean(v.value);
    if (!value) continue;
    fields[k] = { label: clean(v.label) || k, value };
  }
  return {
    ...(clean(data.title) ? { title: clean(data.title) } : {}),
    ...(Object.keys(fields).length ? { fields } : {}),
  };
}

function hasApaarData(parsed: ParsedVtopPage, html: string): boolean {
  return (
    (parsed.keyValuePairs && Object.keys(parsed.keyValuePairs).length > 0) ||
    (parsed.tables && parsed.tables.some((t) => t.rows.length > 0)) ||
    Object.values(parsed.formFields || {}).some((v) => v && v.length > 4 && v !== "-" && !v.startsWith("0")) ||
    /\.pdf/i.test(html) ||
    /already uploaded|submitted successfully/i.test(html)
  );
}

export async function POST(req: Request) {
  try {
    const { cookies, authorizedID, csrf } = await req.json().catch(() => ({}));
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    if (!csrf || !authorizedID) {
      return NextResponse.json({ success: false, error: "Missing csrf or authorizedID" }, { status: 400 });
    }

    const client = VTOPClient();
    const headers = { ...BASE_HEADERS, Cookie: cookieHeader };
    const post = (url: string) => client.post(url, formParams(String(authorizedID), String(csrf)), { headers });

    const [
      studentRes,
      proctorRes,
      hodDeanRes,
      credentialsRes,
      apaarRes,
      bankRes,
      contactRes,
      acknowledgementRes,
      dayboarderRes,
      eptRes,
    ] = await Promise.all([
      post("/vtop/studentsRecord/StudentProfileAllView"),
      post("/vtop/proctor/viewProctorDetails"),
      post("/vtop/hrms/viewHodDeanDetails"),
      post("/vtop/proctor/viewStudentCredentials"),
      post("/vtop/apaarid/upload"),
      post("/vtop/studentBankInformation/BankInfoStudent"),
      post("/vtop/hrms/contactDetails"),
      post("/vtop/admissions/AcknowledgmentView"),
      post("/vtop/admissions/dayboarderForMenu"),
      post("/vtop/compre/eptScheduleShow"),
    ]);

    const student = parseStudentProfile(String(studentRes.data ?? ""));
    const proctor = parseProctor(String(proctorRes.data ?? ""));
    const hodDean = parseHodDean(String(hodDeanRes.data ?? ""));
    const credentials = parseCredentials(String(credentialsRes.data ?? ""));
    const apaarParsed = parseVtopHtml(String(apaarRes.data ?? ""));
    const apaarHas = hasApaarData(apaarParsed, String(apaarRes.data ?? ""));
    const bank = parseBankInfo(String(bankRes.data ?? ""));
    const contact = parseContact(String(contactRes.data ?? ""));
    const acknowledgement = parseAcknowledgement(String(acknowledgementRes.data ?? ""));
    const dayboarder = cleanDayboarder(parseDayboarder(String(dayboarderRes.data ?? "")));
    const eptSchedule = cleanParsedPage(parseVtopHtml(String(eptRes.data ?? "")));

    const identity = buildIdentity({
      student,
      proctor,
      hodDean,
      credentials,
      apaar: apaarParsed,
      hasApaar: apaarHas,
      bank,
    });

    return NextResponse.json({
      success: true,
      identity,
      profile: student,
      credentials: {
        ...(clean(credentials.title) ? { title: clean(credentials.title) } : {}),
        credentials: credentials.credentials,
        ranks: credentials.ranks,
      },
      apaar: { hasApaar: apaarHas, ...cleanParsedPage(apaarParsed) },
      contact,
      acknowledgement,
      dayboarder,
      eptSchedule,
    });
  } catch (err: unknown) {
    console.error("whoami error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ success: false, error: publicErrorMessage(err) }, { status: 500 });
  }
}
