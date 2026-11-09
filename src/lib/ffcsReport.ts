/**
 * The semester's public FFCS registration report, loaded on the server.
 *
 * The friend finder validates every submitted class id against this report, so
 * a plan can only name sections that are really offered. The report is the
 * same CSV the AmazeCC planner reads (`amazecc.com/ffcs/*.csv`), fetched from
 * there rather than copied into this repo, so the planner and the server can
 * never disagree about which sections exist.
 *
 * Cached per instance for a few hours. If a refresh fails, the stale copy keeps
 * serving: a report that is a few hours old is still right, and a friend finder
 * that is down during the registration rush is the failure that matters.
 */

export type FfcsOffering = {
  classId: string;
  code: string;
  title: string;
  /** Component type from the report: TH, ETH, ELA, LO, SS, EPJ, PJT, … */
  type: string;
  credits: string;
  room: string;
  /** e.g. "B1+TB1" or "L31+L32"; "NIL" for project components. */
  slot: string;
  faculty: string;
};

export type FfcsReport = {
  semesterId: string;
  offerings: Map<string, FfcsOffering>;
  loadedAt: number;
};

/**
 * VTOP semester id → report file. Keep in step with `FINAL_FFCS_REPORTS` in
 * AmazeCC's `src/lib/ffcsReports.ts`.
 *
 * A class id embeds its semester id (CH2026270501792 belongs to CH20262705), so
 * this map is also the list of semesters the friend finder supports.
 */
export const FFCS_REPORT_FILES: Record<string, string> = {
  CH20262705: "winter-2026-2027-final-ffcs.csv",
};

const DEFAULT_REPORT_BASE = "https://amazecc.com/ffcs/";
const FRESH_FOR_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

export class ReportUnavailableError extends Error {
  constructor(semesterId: string, cause: string) {
    super(`FFCS report for ${semesterId} could not be loaded: ${cause}`);
    this.name = "ReportUnavailableError";
  }
}

export function isSupportedSemester(semesterId: unknown): semesterId is string {
  return typeof semesterId === "string" && Object.hasOwn(FFCS_REPORT_FILES, semesterId);
}

/**
 * RFC 4180-style CSV: quoted fields may hold commas and doubled quotes. Course
 * titles do ("Robotics: Kinematics, Dynamics and Motion Control"), so a plain
 * split on commas shifts every later column on those rows.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

/** Columns are found by header name, so a reordered export still parses. */
export function parseReport(csv: string): Map<string, FfcsOffering> {
  const [header, ...rows] = parseCsv(csv);
  if (!header) throw new Error("empty report");
  const col = (name: string) => header.findIndex((h) => h.trim().toUpperCase() === name);
  const idx = {
    code: col("COURSE CODE"),
    title: col("COURSE TITLE"),
    type: col("TYPE"),
    credits: col("CREDITS"),
    classId: col("CLASS ID"),
    room: col("ROOM"),
    slot: col("SLOT"),
    faculty: col("EMPLOYEE NAME"),
  };
  if (idx.classId < 0 || idx.code < 0 || idx.slot < 0) {
    throw new Error("report is missing CLASS ID, COURSE CODE or SLOT");
  }

  const at = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const offerings = new Map<string, FfcsOffering>();
  for (const r of rows) {
    const classId = at(r, idx.classId).toUpperCase();
    if (!classId || offerings.has(classId)) continue;
    offerings.set(classId, {
      classId,
      code: at(r, idx.code).toUpperCase(),
      title: at(r, idx.title),
      type: at(r, idx.type).toUpperCase(),
      credits: at(r, idx.credits),
      room: at(r, idx.room),
      slot: at(r, idx.slot).toUpperCase(),
      faculty: at(r, idx.faculty),
    });
  }
  return offerings;
}

const cache = new Map<string, FfcsReport>();
const inFlight = new Map<string, Promise<FfcsReport>>();

async function fetchReport(semesterId: string): Promise<FfcsReport> {
  const base = process.env.FFCS_REPORT_BASE_URL || DEFAULT_REPORT_BASE;
  const url = new URL(FFCS_REPORT_FILES[semesterId], base.endsWith("/") ? base : `${base}/`);
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url.host}`);
  const offerings = parseReport(await res.text());
  if (!offerings.size) throw new Error("report parsed to zero offerings");
  return { semesterId, offerings, loadedAt: Date.now() };
}

export async function getReport(semesterId: string): Promise<FfcsReport> {
  if (!isSupportedSemester(semesterId)) {
    throw new ReportUnavailableError(semesterId, "semester not supported");
  }
  const cached = cache.get(semesterId);
  if (cached && Date.now() - cached.loadedAt < FRESH_FOR_MS) return cached;

  let pending = inFlight.get(semesterId);
  if (!pending) {
    pending = fetchReport(semesterId).finally(() => inFlight.delete(semesterId));
    inFlight.set(semesterId, pending);
  }
  try {
    const fresh = await pending;
    cache.set(semesterId, fresh);
    return fresh;
  } catch (err: unknown) {
    if (cached) return cached;
    throw new ReportUnavailableError(semesterId, err instanceof Error ? err.message : String(err));
  }
}
