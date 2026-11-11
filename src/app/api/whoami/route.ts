import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import * as cheerio from "cheerio";
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
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data.fields || {})) {
    if (k === "_csrf" || k === "authorizedID") continue;
    const value = clean(v.value);
    if (!value) continue;
    const selectedOpt = (v.options || []).find((o) => o.selected) || (v.options || []).find((o) => clean(o.value) === value);
    const selectedText = clean(selectedOpt?.text);
    fields[k] = {
      label: clean(v.label) || k,
      value,
      ...(selectedText && selectedText !== value ? { selectedText } : {}),
    };
  }
  return {
    ...(clean(data.title) ? { title: clean(data.title) } : {}),
    ...(Object.keys(fields).length ? { fields } : {}),
  };
}

function cleanEptSchedule(html: string) {
  const $ = cheerio.load(html);
  const parsed = cleanParsedPage(parseVtopHtml(html));
  const title = clean(parsed.title) || clean($("h3.box-title, .box-title, h2, h3, strong").first().text());
  const candidates = [
    ...$(".alert, .callout, .text-info, .text-warning, .text-danger, .text-success, .box-body").map((_, el) => $(el).text()).get(),
    ...$("p, span, div, td, b").map((_, el) => $(el).text()).get(),
  ];
  let status: string | undefined;
  for (const raw of candidates) {
    let t = clean(raw);
    if (!t) continue;
    if (title && t.toLowerCase().startsWith(title.toLowerCase())) t = clean(t.slice(title.length));
    if (!t) continue;
    if (/exam will be scheduled|not\s+scheduled|no\s+ept|not\s+available|schedule/i.test(t) && t.length <= 180) {
      status = t;
      break;
    }
  }
  const out: Record<string, any> = { ...(parsed as any) };
  if (title) out.title = title;
  if (status && !out.message) out.message = status;
  return out;
}

function cleanAcknowledgement(data: ReturnType<typeof parseAcknowledgement>) {
  const docs = (data.documents || []).map((d) => ({
    ...(clean(d.serialNo) ? { serialNo: clean(d.serialNo) } : {}),
    ...(clean(d.documentName) ? { documentName: clean(d.documentName) } : {}),
    ...(clean(d.status) ? { status: clean(d.status) } : {}),
  })).filter((d) => d.documentName || d.serialNo || d.status);
  const out: Record<string, any> = {};
  if (clean(data.title)) out.title = clean(data.title);
  // Keep only acknowledgement-specific/non-duplicate fields (identity already has profile info).
  if (docs.length) out.documents = docs;
  const reg = clean(data.registerNo), app = clean(data.applicationNo), prog = clean(data.programme), br = clean(data.branch), campus = clean(data.campus);
  if (app) out.applicationNo = app;
  if (reg) out.registerNo = reg;
  if (prog) out.programme = prog;
  if (br) out.branch = br;
  if (campus) out.campus = campus;
  return out;
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
    const post = async (name: string, url: string) => {
      try {
        const res = await client.post(url, formParams(String(authorizedID), String(csrf)), { headers });
        const html = String(res.data ?? "");
        if (res.status >= 400) return { name, html: "", error: `HTTP ${res.status}` };
        return { name, html, error: null as string | null };
      } catch (e: any) {
        return { name, html: "", error: e?.message || String(e) };
      }
    };

    // Run sequentially to avoid VTOP session/rate issues; each request is independent.
    const sources = [
      ["student", "/vtop/studentsRecord/StudentProfileAllView"],
      ["proctor", "/vtop/proctor/viewProctorDetails"],
      ["hodDean", "/vtop/hrms/viewHodDeanDetails"],
      ["credentials", "/vtop/proctor/viewStudentCredentials"],
      ["apaar", "/vtop/apaarid/upload"],
      ["bank", "/vtop/studentBankInformation/BankInfoStudent"],
      ["contact", "/vtop/hrms/contactDetails"],
      ["acknowledgement", "/vtop/admissions/AcknowledgmentView"],
      ["dayboarder", "/vtop/admissions/dayboarderForMenu"],
      ["eptSchedule", "/vtop/compre/eptScheduleShow"],
    ] as const;
    const results: Record<string, { html: string; error: string | null }> = {};
    for (const [name, url] of sources) {
      results[name] = await post(name, url);
    }

    const fetchErrors = Object.fromEntries(Object.entries(results).filter(([, v]) => v.error).map(([k, v]) => [k, v.error]));
    const studentRes = { data: results.student.html };
    const proctorRes = { data: results.proctor.html };
    const hodDeanRes = { data: results.hodDean.html };
    const credentialsRes = { data: results.credentials.html };
    const apaarRes = { data: results.apaar.html };
    const bankRes = { data: results.bank.html };
    const contactRes = { data: results.contact.html };
    const acknowledgementRes = { data: results.acknowledgement.html };
    const dayboarderRes = { data: results.dayboarder.html };
    const eptRes = { data: results.eptSchedule.html };

    const student = parseStudentProfile(String(studentRes.data ?? ""));
    const proctor = parseProctor(String(proctorRes.data ?? ""));
    const hodDean = parseHodDean(String(hodDeanRes.data ?? ""));
    const credentials = parseCredentials(String(credentialsRes.data ?? ""));
    const apaarParsed = parseVtopHtml(String(apaarRes.data ?? ""));
    const apaarHas = hasApaarData(apaarParsed, String(apaarRes.data ?? ""));
    const bank = parseBankInfo(String(bankRes.data ?? ""));
    const contact = parseContact(String(contactRes.data ?? ""));
    const acknowledgement = cleanAcknowledgement(parseAcknowledgement(String(acknowledgementRes.data ?? "")));
    const dayboarder = cleanDayboarder(parseDayboarder(String(dayboarderRes.data ?? "")));
    const eptSchedule = cleanEptSchedule(String(eptRes.data ?? ""));

    const identity = buildIdentity({
      student,
      proctor,
      hodDean,
      credentials,
      apaar: apaarParsed,
      hasApaar: apaarHas,
      bank,
    });

    // Flatten/unify: identity is canonical (profile, officials, credentials/ranks, apaar, bank).
    // Contact remains nested; other sources are included as flattened, non-duplicated data.
    return NextResponse.json({
      success: Object.keys(fetchErrors).length === 0,
      ...(Object.keys(fetchErrors).length ? { fetchErrors } : {}),
      ...identity,
      contact: contact.contacts ?? [],
      ...(clean(contact.title) ? { contactTitle: clean(contact.title) } : {}),
      ...(Object.keys(acknowledgement).length ? { acknowledgement } : {}),
      ...(Object.keys(dayboarder).length ? { dayboarder } : {}),
      ...(Object.keys(eptSchedule).length ? { eptSchedule } : {}),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("whoami error:", msg, err);
    return NextResponse.json({ success: false, error: publicErrorMessage(err) }, { status: 500 });
  }
}
