// Generates the per-endpoint reference pages under docs/03-api-reference/ from
// grounding/route-inventory.json. Pages carry a `{/* generated: aapi2 */}`
// marker; hand-written pages (marker absent) are never overwritten. Idempotent.
// Usage: node grounding/gen-reference-pages.mjs [--check]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const INVENTORY = join(ROOT, "grounding", "route-inventory.json");
const DOCS = join(ROOT, "docs", "03-api-reference");
const CHECK = process.argv.includes("--check");
const MARKER = "{/* generated: aapi2 */}";

const CATS = {
  auth: { dir: "auth-system", title: "Auth & System", intro: "The door in and the lights that say the server is alive. Log in here, check the heartbeat, broadcast a push notification, or ask the gateway what it is." },
  academics: { dir: "academics-vtop", title: "Academics & VTOP", intro: "The academic heart of the API: attendance, marks, grades, the FFCS planner bundle, courses, curriculum, calendar, circulars, hostel and on-duty - every one of these is a VTOP page turned into JSON." },
  transport: { dir: "transport-buses", title: "Transport & Buses", intro: "Buses and the VTOP registration flow. The directory is our PostgreSQL copy; registration state and QR codes are scraped live from VTOP." },
  finance: { dir: "finance", title: "Finance", intro: "Fees: dues views, no-dues certificates and the finance surfaces of VTOP. Heaviest scraper in the codebase after attendance - read the notes before touching it." },
  clubs: { dir: "clubs-events", title: "Clubs & Events", intro: "Eventhub (events & registration) and the club ecosystem: public directory, rep-managed club feeds and landing pages, and the admin moderation surface." },
  social: { dir: "social", title: "Social (FFCS Partners)", intro: "Timetable sharing and the friend finder. Identity is always verified against VTOP server-side (identifyCaller) - a reg number in a body is never trusted. Pairings are mutual, encrypted at rest and revocable." },
  qbank: { dir: "qbank", title: "QBank", intro: "Question banks and previous papers: public read, public pending-upload, admin-moderated approval pipeline (OCR -> questions -> publish). Files live on Backblaze B2." },
  gorobo: { dir: "gorobo", title: "GoRobo Shop", intro: "The internal GoRobo shop - catalog, ordering, stock and wallet settlement. Public catalog + orders, admin-gated management." },
  lms: { dir: "lms-koha", title: "LMS & Koha", intro: "Moodle (LMS) and Vitol scrapes with your own Moodle credentials, and the Koha library OPAC proxied as JSON (public endpoints)." },
  faculty: { dir: "faculty", title: "Faculty Directory", intro: "The faculty directory scrape: schools from our DB, page contents scraped on demand and cached." },
  cabshare: { dir: "cabshare", title: "CabShare", intro: "Hostel cab-share: trip planning, matching, blocking, ratings and waitlists. Not the friend finder - a separate, simpler board." },
  admin: { dir: "admin", title: "Admin", intro: "Everything behind the admin bearer: users, storage, Buses/transport, clubs, fresher resources, QBank moderation and the GoRobo back office. Read the Admin auth page before using any of these." },
  system: { dir: "auth-system", title: "Auth & System", intro: "The door in and the lights that say the server is alive. Log in here, check the heartbeat, broadcast a push notification, or ask the gateway what it is." },
};

const AUTH_LABEL = {
  none: { name: "None", detail: "Public - no credentials required. Still rate-limited where noted." },
  vtop: { name: "VTOP session (body)", detail: "Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`." },
  moodle: { name: "Moodle/Vitol LMS (body)", detail: "`{ username, pass }` in the JSON body. Sent per-request; never stored. See the LMS auth page." },
  admin: { name: "Admin bearer token", detail: "`Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately)." },
  club: { name: "Club bearer token", detail: "`Authorization: Bearer <club token>` - issued at `POST /api/login` when the authorizedID represents club(s). `X-Club-Id` header re-selects the club context." },
  cabshare: { name: "CabShare token", detail: "`Authorization: Bearer <cabshare token>` - from `POST /api/cabshare/auth` (30-day TTL, needs `cabshare_users` row)." },
  eventhub: { name: "EventHub (body)", detail: "`{ username, password }` or a cached `{ jsessionid }` in the body. jsessionid cached by the client; re-login handled automatically (`looksLikeLoginPage`)." },
  social: { name: "Social identity (VTOP-verified)", detail: "Body carries `cookies` + `authorizedID` + `csrf`; the server verifies them VTOP-side and derives your identity - the body never asserts identity." },
  cron: { name: "CRON_SECRET bearer", detail: "`Authorization: Bearer <CRON_SECRET>` compared with `timingSafeEqual`. Server-side only - never call from a browser." },
  "gorobo-admin": { name: "Admin bearer + permission", detail: "`Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass." },
};

const slugify = (path) =>
  path.replace(/^\/api\//, "").replace(/[[\]]/g, "").split("/").filter(Boolean).join("-");

const ACRONYMS = new Set(["lms","qbank","vtop","koha","ocr","od","api","id","sql","b2","hmac","pii","ip","ffcs","sync","ttl","spa"]);
const titleWord = (w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1));
const titleCase = (s) => s.split(/[-\s]+/).filter(Boolean).map(titleWord).join(" ");

const titleFor = (path) => {
  const segs = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  let last = segs[segs.length - 1];
  let action = null;
  const ACTION_PREFIX = { complete: "Complete", confirm: "Confirm", archive: "Archive", unarchive: "Unarchive", reject: "Reject", publish: "Publish", seed: "Seed", promote: "Promote", settle: "Settle", stock: "Stock", clicked: "Clicked" };
  if (segs.length >= 2 && ACTION_PREFIX[segs[segs.length - 1]] && /^\[/.test(segs[segs.length - 2])) {
    action = ACTION_PREFIX[segs[segs.length - 1]];
    return `${action} ${titleCase(segs.slice(-3, -1).join(" ").replace(/[\[\]]/g, ""))}`;
  }
  const cleaned = last.replace(/[[\]]/g, "");
  if (/^\[/.test(last)) {
    const parent = segs[segs.length - 2] ?? "item";
    return `${titleCase(parent)} [${cleaned}]`;
  }
  const t = titleCase(cleaned);
  return /\d/.test(cleaned) && segs.length >= 2 ? `${titleCase(segs[segs.length - 2] ?? "")} ${t}` : t;
};

const jsonLiteral = (v) => JSON.stringify(v, null, 2);

// Parse the first {...} object literal-ish chunk out of a `returns` string and
// emit a skeleton JSON object with the same top-level keys (values are
// placeholders, never fake data).
const skeletonFromReturns = (returns) => {
  const str = String(returns);
  const start = str.indexOf("{");
  if (start === -1) return null;
  let depth = 0, end = -1;
  for (let i = start; i < str.length; i++) {
    const c = str[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return null;
  const body = str.slice(start + 1, end);
  const keys = [];
  let d = 0, cur = "";
  const flush = () => {
    const k = cur.trim().replace(/\?$/, "");
    const m = /^([A-Za-z_$][\w$-]*)/.exec(k);
    if (m) keys.push(m[1]);
    cur = "";
  };
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "{") d++;
    else if (c === "}") d--;
    else if (d === 0 && c === ",") flush();
    else cur += c;
  }
  flush();
  const obj = {};
  for (const k of keys) {
    if (k === "success") obj[k] = true;
    else if (/^data|^results|^classes|^trips|^users|^clubs|^hubs|^resources|^items|^questions|^papers/.test(k)) obj[k] = "...";
    else if (/^(id|qty|count|page|limit|total|version|rowCount|hasMore)$/i.test(k)) obj[k] = 1;
    else if (/^(is|has|success|ok|stale|revoked|archived|complete|paid)$/.test(k)) obj[k] = true;
    else if (/^(message|error|reason|detail|note|snippet|text)$/.test(k)) obj[k] = "...";
    else obj[k] = "...";
  }
  return keys.length ? obj : null;
};

const extractParams = (body) => {
  // inventory body arrays are coarse tokens like "cookies", "semesterId", "items[{itemId,qty}]", "<array> of students"
  return body.map((t) => {
    const clean = String(t);
    if (clean.includes("?")) return { key: clean.replace(/\?$/, ""), required: false };
    return { key: clean, required: true };
  });
};

const exampleFor = (key) => {
  if (/^cookies$|^authorizedID$|^csrf/.test(key)) return "from POST /api/login>";
  if (/semesterId/i.test(key)) return "CH20262705";
  if (/classIds?/i.test(key)) return ["CH2026270102069"];
  if (/paperId/i.test(key)) return "<paper id>";
  if (/hub_id|courseCode|vtop_id|club_id|notif_id|grantId|handle/i.test(key)) return "...";
  if (/phone/i.test(key)) return "9xxxxxxxxx";
  if (/username/i.test(key)) return "21BCE0000";
  if (/password|pass/i.test(key)) return "<your password>";
  if (/items/i.test(key)) return [{ itemId: "...", qty: 1 }];
  if (/endpoints/i.test(key)) return ["attendance", "marks"];
  if (/^\d+$/.test(key)) return 0;
  if (/count|limit|page|delta/i.test(key)) return 10;
  if (/flag|enabled/i.test(key)) return true;
  if (/^[a-z_]+$/i.test(key) && /ids?$/i.test(key)) return [];
  if (/url|jsessionid/i.test(key)) return "...";
  if (/secret/i.test(key)) return "...";
  return "...";
};

const bodyTemplate = (inv) => {
  const skip = new Set(["cookies", "authorizedID", "csrf"]);
  const t = {};
  for (const k of inv.body) {
    const base = String(k)
      .replace(/\?$/, "")
      .replace(/^<array> of /, "")
      .replace(/\[.+\]$/, "")
      .replace(/\[.*\]$/, "")
      .replace(/[\[\]]/g, "")
      .trim();
    if (!base) continue;
    if (skip.has(base)) continue;
    t[base] = exampleFor(base);
  }
  return t;
};

const methodsLine = (inv) => inv.methods.join(", ");
// MDX treats raw { ... } in prose as a JS expression; HTML-entity-escape them everywhere we emit notes.
const escMdx = (s) => String(s).replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");

const pageFor = (inv) => {
  const cat = CATS[inv.cat];
  const auth = AUTH_LABEL[inv.auth] ?? AUTH_LABEL.none;
  const isVtopBody = inv.auth === "vtop" || inv.auth === "social";
  const bodyKeys = extractParams(inv.body).filter((_, i) => !["cookies", "authorizedID", "csrf"].includes(inv.body[i]));
  const exampleBody = bodyTemplate(inv);
  const curl = `curl -X ${inv.methods[0]} "https://api.amazecc.com${inv.path}" \\
  -H "Content-Type: application/json"${
    inv.auth === "admin" || inv.auth === "gorobo-admin" || inv.auth === "club" || inv.auth === "cabshare" ? ' \\\n  -H "Authorization: Bearer <token>"' : ""
  }${
    inv.auth === "cron" ? ' \\\n  -H "Authorization: Bearer CRON_SECRET>"' : ""
  }${
    bodyKeys.length
      ? ` \\\n  -d '${jsonLiteral(exampleBody).replace(/\n/g, "\n         ")}'`
      : ""
  }`;
  const table = bodyKeys.length
    ? bodyKeys
        .map(
          ({ key, required }) =>
            `| \`${String(key).replace(/^<array> /, "` *(array)* `")}\` | ${required ? "required" : "optional"} | see code |`,
        )
        .join("\n")
    : "| _none_ | - | - |";
  const pathParam = inv.path.includes("[") ? `\n\n> Path parameter: the bracketed segment is part of the route (e.g. \`[id]\`).` : "";

  return `---
title: "${titleFor(inv.path)}"
description: "${cat.title} - ${inv.methods.join("/")} ${inv.path}. ${inv.notes.slice(0, 140).replace(/[{}]/g, "_")}"
---

${MARKER}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# \`${inv.methods.join(", ")} ${inv.path}\`

> **In one line:** ${escMdx(inv.notes)}

## Auth

**${auth.name}.** ${auth.detail}
${isVtopBody ? "\nExactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login)." : ""}

## Request

**Method:** ${methodsLine(inv)}  
**Path:** \`${inv.path}\`${pathParam}

| Field | Required | Type notes |
|---|---|---|
${table}

## Response

\`\`\`json
${jsonLiteral(skeletonFromReturns(inv.returns) ?? { success: true })}
\`\`\`

> Full shape: \`${inv.returns}\`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/${cat.dir}.md)
${inv.rl && inv.rl !== "-" ? `\n**Rate limit:** ${inv.rl}\n` : ""}
## Try it live

<EndpointTry path="${inv.path}" method="${inv.methods[0].toLowerCase()}" auth="${inv.auth}" />

## curl

\`\`\`bash
${curl}
\`\`\`
`;
};

const indexPage = (cat, routes) => {
  const rows = routes
    .map(
      (r) =>
        `| ${r.methods.map((m) => m.toLowerCase()).join(", ")} | \`${r.path}\` | ${AUTH_LABEL[r.auth]?.name ?? r.auth} | ${r.rl && r.rl !== "-" ? r.rl : "-"} |`,
    )
    .join("\n");
  return `---
title: "${cat.title}"
description: "Every ${cat.title} endpoint: method, path, auth and rate limits."
---

${MARKER}

# ${cat.title}

> **In one line:** ${cat.intro}

| Method | Path | Auth | Rate limit |
|---|---|---|---|
${rows}
`;
};

const inventory = JSON.parse(readFileSync(INVENTORY, "utf8"));

const byCat = {};
for (const inv of inventory) {
  const catName = inv.cat;
  if (!CATS[catName]) {
    console.error(`No category mapping for ${catName} (${inv.path})`);
    process.exit(1);
  }
  (byCat[CATS[catName].dir] ??= []).push(inv);
}

let written = 0, skipped = 0;
const seen = new Set();
for (const [dir, routes] of Object.entries(byCat)) {
  const cat = Object.values(CATS).find((c) => c.dir === dir);
  const dirPath = join(DOCS, dir);
  if (!CHECK) mkdirSync(dirPath, { recursive: true });

  // category index
  const indexFile = join(dirPath, "index.md");
  const content = indexPage(cat, routes);
  if (CHECK) {
    if (!existsSync(indexFile)) console.error("MISSING:", indexFile);
  } else if (!existsSync(indexFile) || readFileSync(indexFile, "utf8").includes(MARKER)) {
    writeFileSync(indexFile, content, "utf8");
    written++;
  } else skipped++;

  for (const inv of routes) {
    let slug = slugify(inv.path);
    const leaf = dir.split("/").pop();
    if (slug.startsWith(`${leaf}-`)) slug = slug.slice(leaf.length + 1);
    const file = join(dirPath, `${slug}.md`);
    if (seen.has(file)) {
      console.error("SLUG COLLISION:", file);
      process.exit(1);
    }
    seen.add(file);
    const page = pageFor(inv);
    if (CHECK) {
      if (!existsSync(file)) console.error("MISSING:", file);
      continue;
    }
    if (!existsSync(file) || readFileSync(file, "utf8").includes(MARKER)) {
      writeFileSync(file, page, "utf8");
      written++;
    } else skipped++;
  }
}
console.log(CHECK ? `check complete` : `written: ${written}, skipped (hand-written kept): ${skipped}`);
