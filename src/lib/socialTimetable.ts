import * as cheerio from "cheerio";
import { isValidKey, slotTime, TOTAL_SLOTS, SLOTMAP_VERSION, daysForSlot } from "./socialVocabulary";
import type { BusyEntry, BusyMap, SocialCourse } from "./socialTypes";

/**
 * Parser for `POST /vtop/processViewTimeTable`.
 *
 * The layout below was established against live VTOP, not assumed. It
 * previously WAS assumed — the design guessed `"<slots> / <venue>"` — and that
 * guess was wrong: the real separator is `" - "`. Splitting on `/` yields one
 * bogus "slot" per course, so every key would fail ingest validation and the
 * whole publish would 400. The other near-miss is `split("-")`, which breaks
 * on slot ids like `S8B` and venue names like `AB1-607B`.
 *
 * Columns are located by HEADER NAME, not index. The existing
 * `fetchTimeTable.ts` uses indices, and a VTOP layout change would then shift
 * every field silently. `resolveColumns` throws when a required header is
 * missing so a layout change is a loud failure.
 */

/** Live header row, in order. */
export const TIMETABLE_HEADERS = [
  "Sl.No",
  "Class Group",
  "Course",
  "L T P J C",
  "Category",
  "Course Option",
  "Class Id",
  "Slot/ Venue",
  "Faculty Details",
  "Registered / Updated Date & Time",
  "Attendance Date/ Type",
  "Status & Ref. No.",
] as const;

type ColumnName = (typeof TIMETABLE_HEADERS)[number];

function normaliseHeader(h: string): string {
  return h.replace(/\s+/g, " ").trim().toLowerCase();
}

/** `"L T P J C"` normalises to `"l t p j c"`; `"Slot/ Venue"` to `"slot/ venue"`. */
function columnKey(h: string): string {
  return normaliseHeader(h);
}

export function resolveColumns(headerCells: string[]): Record<string, number> {
  const wanted: Record<string, ColumnName> = {
    course: "Course",
    ltpjc: "L T P J C",
    category: "Category",
    classId: "Class Id",
    slotVenue: "Slot/ Venue",
    faculty: "Faculty Details",
  };

  const out: Record<string, number> = {};
  const missing: string[] = [];

  for (const [key, label] of Object.entries(wanted)) {
    const target = columnKey(label);
    const idx = headerCells.findIndex((h) => columnKey(h) === target);
    if (idx >= 0) out[key] = idx;
    else missing.push(label);
  }

  if (missing.length) {
    // A layout change must be a loud failure, not silently shifted data.
    throw new Error(
      `Timetable layout changed: could not find column(s) ${missing.join(", ")}. ` +
        `Headers seen: ${headerCells.join(" | ")}`
    );
  }
  return out;
}

/** First `<tr>` of the table: its cells are the header. */
export function extractHeaderCells(html: string): string[] {
  const $ = cheerio.load(html);
  const cells: string[] = [];
  $("table.table")
    .first()
    .find("thead th, tr:first-child th, tr:first-child td")
    .each((_, el) => {
      cells.push($(el).text().replace(/\s+/g, " ").trim());
    });
  return cells;
}

/**
 * `"L31+L32+L37+L38 - AB1-607B"` → slots `["L31","L32","L37","L38"]`,
 * venue `"AB1-607B"`.
 *
 * The separator is whitespace-delimited on both sides. A bare `split("-")`
 * would corrupt `S8B` and `AB1-607B`.
 */
export function splitSlotVenue(raw: string): { slots: string[]; venue: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { slots: [], venue: "" };
  const [slotPart, ...rest] = trimmed.split(/\s+-\s+/);
  return {
    slots: (slotPart ?? "").split("+").map((s) => s.trim()).filter(Boolean),
    venue: rest.join(" - ").trim(),
  };
}

/**
 * `"BACSE102 - Problem Solving Using Java ( Lab Only )"` →
 * code `BACSE102`, title `Problem Solving Using Java`, type `Lab Only`.
 *
 * The existing parser synthesised `"BACSE102(L)"` as a "code" and inferred
 * theory-vs-lab from whether a *slot* began with `L`, which misclassifies
 * `F1+TF1` (an **Embedded Theory** course). Both are read properly here.
 */
export function parseCourseCell(raw: string): {
  code: string;
  title: string;
  componentType: string;
} {
  const trimmed = (raw ?? "").trim();
  const m = /^(\S+)\s+-\s+(.*?)\s*\(\s*([^)]+?)\s*\)$/.exec(trimmed);
  if (m) {
    return { code: m[1] ?? "", title: m[2] ?? "", componentType: m[3] ?? "" };
  }
  // Fall back to something usable rather than dropping the course.
  const dash = trimmed.split(/\s+-\s+/);
  return {
    code: (dash[0] ?? trimmed).split(" ")[0] ?? "",
    title: (dash[1] ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim(),
    componentType: (/\(([^)]+)\)/.exec(trimmed)?.[1] ?? "").trim(),
  };
}

export type ParseResult = {
  busyMap: BusyMap;
  courses: SocialCourse[];
  semesterMismatch: boolean;
  classIdSamples: string[];
  invalidKeys: string[];
};

export class UnknownSlotError extends Error {
  readonly invalidKeys: string[];
  constructor(invalidKeys: string[]) {
    super(
      `Published busy map contains ${invalidKeys.length} slot key(s) outside the vocabulary: ${invalidKeys.slice(0, 5).join(", ")}${invalidKeys.length > 5 ? "…" : ""}`
    );
    this.name = "UnknownSlotError";
    this.invalidKeys = invalidKeys;
  }
}

/**
 * Build the busy map and course list from the timetable page.
 *
 * Fails the whole parse on a single unknown key: a partially-accepted map
 * would look complete and be wrong, which is worse than a 400.
 */
export function parseTimetable(html: string, semesterId: string): ParseResult {
  const $ = cheerio.load(html);
  const headerCells = extractHeaderCells(html);
  if (!headerCells.length) {
    throw new Error("Timetable table not found in the response");
  }
  const cols = resolveColumns(headerCells);

  const busyMap: BusyMap = {};
  const courses: SocialCourse[] = [];
  const seenCourses = new Set<string>();
  const invalidKeys = new Set<string>();
  const classIdSamples: string[] = [];

  $("table.table")
    .first()
    .find("tbody tr")
    .each((_, tr) => {
      const cells: string[] = [];
      $(tr)
        .find("td")
        .each((__, td) => {
          cells.push($(td).text().replace(/\s+/g, " ").trim());
        });
      if (!cells.length) return;

      const courseRaw = cells[cols.course as number] ?? "";
      const slotRaw = cells[cols.slotVenue as number] ?? "";
      if (!courseRaw && !slotRaw) return;

      const { code, title, componentType } = parseCourseCell(courseRaw);
      const { slots, venue } = splitSlotVenue(slotRaw);
      const classId = cells[cols.classId as number] ?? "";
      if (classId) classIdSamples.push(classId);

      // Courses are deduped by class id, because one course appears once per
      // component (Embedded Theory / Embedded Lab) with different class ids.
      if (classId && !seenCourses.has(classId)) {
        seenCourses.add(classId);
        courses.push({
          code,
          title,
          venue,
          ltpjc: cells[cols.ltpjc as number] ?? "",
          // The `Category` column is a course taxonomy ("University Core
          // Courses"), NOT a theory/lab marker. The component type comes from
          // the parenthesised suffix of the Course cell, which is why it is
          // parsed separately rather than inferred from the column.
          category: cells[cols.category as number] ?? "",
          componentType,
          classId,
          faculty: cells[cols.faculty as number] ?? "",
        });
      }

      // A bare slot id is ambiguous, so it fans out across every day it
      // exists on. This is what turns VTOP's day-less ids into (day, slotId).
      for (const slotId of slots) {
        for (const day of daysForSlot(slotId)) {
          const key = `${day}:${slotId}`;
          if (!isValidKey(key)) {
            invalidKeys.add(key);
            continue;
          }
          const entry: BusyEntry = { c: code, t: title, v: venue };
          busyMap[key] = entry;
        }
      }
    });

  if (invalidKeys.size) {
    throw new UnknownSlotError(Array.from(invalidKeys));
  }

  const keyCount = Object.keys(busyMap).length;
  if (keyCount > TOTAL_SLOTS) {
    // Cannot happen with a validated vocabulary, but a silent guard beats a
    // corrupt row if this function is ever changed.
    throw new Error(`busy map has ${keyCount} keys, vocabulary has ${TOTAL_SLOTS}`);
  }

  // VTOP class ids embed the semester code, e.g. CH2026270102069 for
  // CH20262701. A mismatch means the resolved semester was wrong, so the record
  // must be discarded rather than stored.
  const semesterMismatch =
    classIdSamples.length > 0 && !classIdSamples.every((id) => id.startsWith(semesterId));

  return {
    busyMap,
    courses,
    semesterMismatch,
    classIdSamples,
    invalidKeys: [],
  };
}

export { SLOTMAP_VERSION, slotTime, TOTAL_SLOTS };
