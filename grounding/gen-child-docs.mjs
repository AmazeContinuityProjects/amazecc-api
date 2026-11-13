// Generates docs/docs.json for the AmazeCC-API repo (the "child" in Mintlify's
// multirepo setup). Navigation is nested: section headers hold groups.
// Idempotent and safe to re-run.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const DOCS = "docs";

const SECTIONS = [
  { group: "Start here", icon: "rocket", expanded: true, keys: ["00-start-here"] },
  { group: "Authentication", icon: "shield-check", expanded: true, keys: ["01-authentication"] },
  { group: "Internals", icon: "cpu", expanded: true, keys: ["02-internals"] },
  {
    group: "API Reference",
    icon: "book-open",
    expanded: true,
    keys: [
      "03-api-reference/auth-system",
      "03-api-reference/academics-vtop",
      "03-api-reference/transport-buses",
      "03-api-reference/finance",
      "03-api-reference/clubs-events",
      "03-api-reference/social",
      "03-api-reference/qbank",
      "03-api-reference/gorobo",
      "03-api-reference/lms-koha",
      "03-api-reference/faculty",
      "03-api-reference/cabshare",
      "03-api-reference/admin",
    ],
  },
  { group: "Operations", icon: "wrench", expanded: true, keys: ["04-operations"] },
  { group: "Reference", icon: "book", expanded: true, keys: ["05-reference", "05-reference/response-shapes", "m-app"] },
];
const TITLES = {
  "00-start-here": "Start Here",
  "01-authentication": "Authentication",
  "02-internals": "Internals",
  "03-api-reference/auth-system": "Auth & System",
  "03-api-reference/academics-vtop": "Academics & VTOP",
  "03-api-reference/transport-buses": "Transport & Buses",
  "03-api-reference/finance": "Finance",
  "03-api-reference/clubs-events": "Clubs & Events",
  "03-api-reference/social": "Social (FFCS Partners)",
  "03-api-reference/qbank": "QBank",
  "03-api-reference/gorobo": "GoRobo Shop",
  "03-api-reference/lms-koha": "LMS & Koha",
  "03-api-reference/faculty": "Faculty Directory",
  "03-api-reference/cabshare": "CabShare",
  "03-api-reference/admin": "Admin",
  "04-operations": "Operations",
  "05-reference": "Reference",
  "05-reference/response-shapes": "Response Shapes",
  "m-app": "The VITianCC App (RE Notes)",
};
const EXPANDED = new Set(["00-start-here", "01-authentication", "03-api-reference/academics-vtop"]);

function walk(dir, depth = 0) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, depth + 1));
    else if (/\.(md|mdx)$/i.test(e.name)) out.push(relative(DOCS, p).split(sep).join("/").replace(/\.(md|mdx)$/i, ""));
  }
  return out;
}

const ALL_KEYS = SECTIONS.flatMap((s) => s.keys);

const buildGroup = (key) => {
  const dir = join(DOCS, key);
  try {
    if (!statSync(dir).isDirectory()) return null;
  } catch {
    return null;
  }
  // Skip pages that belong to a nested child key (e.g. 05-reference/response-shapes).
  const nested = ALL_KEYS.filter((k) => k !== key && k.startsWith(key + "/"));
  const pages = walk(dir)
    .sort()
    .filter((p) => !nested.some((k) => p === k || p.startsWith(k + "/")));
  const root = pages.find((p) => p === `${key}/index`);
  if (!root && pages.length === 0) return null;
  const rest = pages.filter((p) => p !== root);
  const group = { group: TITLES[key] ?? key, ...(root ? { root } : {}), pages: rest };
  if (EXPANDED.has(key)) group.expanded = true;
  return group;
};

const groups = [];
for (const section of SECTIONS) {
  const children = section.keys.map(buildGroup).filter(Boolean);
  if (children.length === 0) continue;
  groups.push({ group: section.group, icon: section.icon, expanded: section.expanded, pages: children });
}

const doc = {
  $schema: "https://mintlify.com/docs.json",
  name: "AmazeCC-API",
  navigation: { groups },
};
writeFileSync(join(DOCS, "docs.json"), JSON.stringify(doc, null, 2) + "\n", "utf8");
const count = groups.reduce(
  (n, g) => n + g.pages.reduce((m, sub) => m + sub.pages.length + (sub.root ? 1 : 0), 0),
  0,
);
console.log(`wrote docs/docs.json - ${groups.length} sections, ${count} pages`);
