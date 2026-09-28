import * as cheerio from "cheerio";
import type { ParsedSemesterOption, SemesterResolution } from "./socialTypes";

/**
 * Resolving the current calendar semester.
 *
 * ## The verified constraint
 *
 * VTOP's `#semesterSubId` dropdown **always** has the empty
 * `-- Choose Semester --` placeholder marked `selected`, so reading a
 * `selected` attribute can never yield the current semester. This was
 * established against live VTOP, not assumed.
 *
 * The dropdown is also not on the dashboard. It is on the pages the repo
 * already posts to: `StudentCoursePage` (used by `course-page/route.ts`) and
 * `StudentTimeTableChn` (used by `timetable/route.ts`). The option list runs
 * from 2019 and is newest-first, and the option TEXT carries the term name,
 * e.g. `CH20262701` = "Fall Semester 2026-27".
 *
 * ## The mechanism
 *
 * Because the current semester cannot be read directly, it is **proposed by the
 * client and validated against the scraped list**. A caller cannot inject an
 * arbitrary string into a storage key, and cannot point the server at a term
 * the student is not in, because VTOP will refuse to return a timetable for it
 * and the class-id check in `socialTimetable.ts` catches the residue.
 */

export const SEMESTER_SELECTOR =
  'select#semesterSubId option, select[name="semesterSubId"] option';

export const PLACEHOLDER_TEXT = "-- Choose Semester --";

/** Endpoints known to render the dropdown, in preference order. */
export const SEMESTER_PAGES = [
  "/vtop/academics/common/StudentCoursePage",
  "/vtop/academics/common/StudentTimeTableChn",
] as const;

export function parseSemesterOptions(html: string): ParsedSemesterOption[] {
  const $ = cheerio.load(html);
  const out: ParsedSemesterOption[] = [];
  $(SEMESTER_SELECTOR).each((_, el) => {
    const n = $(el);
    const value = String(n.attr("value") ?? "");
    if (!value) return; // the placeholder carries no value
    out.push({
      value,
      text: n.text().replace(/\s+/g, " ").trim(),
      selected: n.attr("selected") !== undefined,
    });
  });
  return out;
}

/**
 * Pick a semester.
 *
 * 1. A `selected` option with a real value would be authoritative. Kept
 *    because it costs nothing and would activate if VTOP ever changes.
 * 2. Otherwise the client's proposal, accepted **only** on exact membership of
 *    the scraped list.
 * 3. Otherwise the first non-empty option, which on a newest-first list is the
 *    most recent term.
 *
 * Throws rather than returning a guess: `semester_not_offered` is an honest
 * 422, whereas a wrong semester produces a plausible-looking wrong timetable.
 */
export function resolveSemester(
  options: ParsedSemesterOption[],
  proposed?: string | null
): SemesterResolution {
  if (!options.length) {
    throw new SemesterListUnavailableError(
      "No semesters could be parsed from the VTOP dropdown"
    );
  }

  const selected = options.find((o) => o.selected);
  if (selected?.value) {
    return {
      semesterId: selected.value,
      semesterLabel: selected.text,
      source: "selected_option",
      optionCount: options.length,
    };
  }

  const wanted = (proposed ?? "").trim();
  if (wanted) {
    const match = options.find((o) => o.value === wanted);
    if (match) {
      return {
        semesterId: match.value,
        semesterLabel: match.text,
        source: "proposed_validated",
        optionCount: options.length,
      };
    }
    throw new SemesterNotOfferedError(wanted, options.length);
  }

  const first = options[0] as ParsedSemesterOption;
  return {
    semesterId: first.value,
    semesterLabel: first.text,
    source: "first_available",
    optionCount: options.length,
  };
}

export class SemesterListUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SemesterListUnavailableError";
  }
}

export class SemesterNotOfferedError extends Error {
  readonly proposed: string;
  readonly optionCount: number;
  constructor(proposed: string, optionCount: number) {
    super(
      `Semester "${proposed}" is not in VTOP's list of ${optionCount} semesters. ` +
        `It is probably not a valid term for this student.`
    );
    this.name = "SemesterNotOfferedError";
    this.proposed = proposed;
    this.optionCount = optionCount;
  }
}

/** A VTOP class id embeds its semester code: CH2026270102069 for CH20262701. */
export function classIdMatchesSemester(classId: string, semesterId: string): boolean {
  return classId.startsWith(semesterId);
}
