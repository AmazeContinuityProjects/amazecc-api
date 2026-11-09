#!/usr/bin/env node
// VTOP canary: log in with a test account through the deployed API and check
// that the main scrapers still return real data. VTOP changes its markup
// without notice; this finds out before students do.
//
//   CANARY_VTOP_USERNAME=... CANARY_VTOP_PASSWORD=... node tools/vtop-canary.mjs
//
// Environment:
//   CANARY_VTOP_USERNAME, CANARY_VTOP_PASSWORD  test account (required)
//   CANARY_API_BASE      default https://api.amazecc.com
//   CANARY_SEMESTER_ID   default: the last entry of config.json semesterIDs
//   CANARY_WEBHOOK_URL   optional; Discord or Slack incoming webhook, posted
//                        to only when a check fails
//
// Exit code 0 when every check passes, 1 when any fails, 2 when misconfigured.
// Never prints passwords, cookies or tokens.
import { readFileSync } from "node:fs";

const env = process.env;
const API = (env.CANARY_API_BASE || "https://api.amazecc.com").replace(/\/+$/, "");
const USER = env.CANARY_VTOP_USERNAME;
const PASS = env.CANARY_VTOP_PASSWORD;
const TIMEOUT_MS = 90_000;

if (!USER || !PASS) {
  console.error("CANARY_VTOP_USERNAME and CANARY_VTOP_PASSWORD must be set.");
  process.exit(2);
}

function defaultSemester() {
  try {
    const ids = JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf8")).semesterIDs;
    return Array.isArray(ids) && ids.length ? ids[ids.length - 1] : "";
  } catch {
    return "";
  }
}
const SEMESTER = env.CANARY_SEMESTER_ID || defaultSemester();

async function call(path, body) {
  const started = Date.now();
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body: reported as a shape failure below */
  }
  return { status: res.status, json, ms: Date.now() - started };
}

const results = [];
async function check(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail, ms: Date.now() - started });
  } catch (err) {
    results.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err), ms: Date.now() - started });
  }
}
function expect(cond, message) {
  if (!cond) throw new Error(message);
}

let session = null;

await check("API health", async () => {
  const r = await call("/api/health");
  expect(r.status === 200 && r.json?.status === "ok", `GET /api/health returned ${r.status}`);
  return `${r.ms} ms`;
});

await check("VTOP login (captcha + credentials)", async () => {
  const r = await call("/api/login", { username: USER, password: PASS });
  expect(r.status === 200 && r.json?.success, `login returned ${r.status}: ${r.json?.message ?? "no message"}`);
  expect(r.json.csrf && r.json.authorizedID && r.json.cookies, "login succeeded but csrf/authorizedID/cookies missing");
  session = { cookies: r.json.cookies, csrf: r.json.csrf, authorizedID: r.json.authorizedID };
  return `${r.ms} ms`;
});

if (session) {
  await check("Student profile parser", async () => {
    const r = await call("/api/student", session);
    expect(r.status === 200, `POST /api/student returned ${r.status}`);
    const filled = Object.values(r.json?.profile ?? {}).filter((v) => v && (typeof v !== "object" || Object.keys(v).length));
    expect(filled.length >= 3, `profile parsed only ${filled.length} non-empty fields`);
    return `${filled.length} fields`;
  });

  await check(`Attendance parser (${SEMESTER || "default semester"})`, async () => {
    const r = await call("/api/attendance", { ...session, semesterId: SEMESTER });
    expect(r.status === 200, `POST /api/attendance returned ${r.status}`);
    const rows = r.json?.attRes?.attendance;
    expect(Array.isArray(rows), "attRes.attendance is missing");
    expect(rows.length > 0, "attendance parsed 0 courses (empty semester, or the table markup changed)");
    const first = rows[0];
    expect(first.courseCode && first.courseTitle !== undefined, "attendance rows lost courseCode/courseTitle");
    return `${rows.length} courses`;
  });
}

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  (${r.detail})`);

if (failed.length && env.CANARY_WEBHOOK_URL) {
  const run = env.GITHUB_SERVER_URL && env.GITHUB_RUN_ID
    ? `\n${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
    : "";
  const text = `VTOP canary: ${failed.length} of ${results.length} checks failed against ${API}\n` +
    failed.map((r) => `- ${r.name}: ${r.detail}`).join("\n") + run;
  try {
    // `content` is Discord's field, `text` is Slack's; each ignores the other.
    await fetch(env.CANARY_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, text }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error("Webhook post failed:", err instanceof Error ? err.message : err);
  }
}

process.exit(failed.length ? 1 : 0);
