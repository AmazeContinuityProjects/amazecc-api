/**
 * FFCS friend finder: plan validation and matching. Pure functions only, so
 * the rules that decide what a caller may submit and see are unit-tested
 * without a database or VTOP.
 *
 * ## The unit of matching is the class id
 *
 * A class id in the registration report is one section: one course component,
 * one faculty member, one slot. Two students who hold the same class id are in
 * the same class, which is the question the finder answers. Matching on
 * faculty names or slot strings instead would split one person across spelling
 * variants and merge different sections that happen to share a slot.
 *
 * ## Why validation is strict
 *
 * The finder shows names. Without limits, a caller could submit every section
 * of a course and read back the whole roster. So a plan must look like a plan
 * a student could actually register:
 *
 * - every class id is offered in that semester's report;
 * - at most one section per course component (one ETH and one ELA of BACSE211,
 *   never two ETH sections);
 * - no two sections claim the same slot;
 * - at most {@link MAX_PLAN_CLASSES} classes.
 *
 * Together with the daily change cap in the route, reading a whole roster
 * would take many different VTOP accounts, rather than one script.
 */

import type { FfcsOffering } from "./ffcsReport";

export const MAX_PLAN_CLASSES = 20;
/** A registered timetable comes from VTOP, not the caller, so it gets more room. */
export const MAX_REGISTERED_CLASSES = 30;
export const MAX_CHANGES_PER_DAY = 10;
export const MAX_OVERLAPS = 50;

export type MatchSource = "planned" | "registered";

const CLASS_ID_RE = /^CH\d{13}$/;

export type PlanValidation =
  | { ok: true; classIds: string[] }
  | { ok: false; error: string; detail: string; offending?: string[] };

/** "B1+TB1" → ["B1", "TB1"]. Project components with no slot ("NIL") occupy none. */
export function slotTokens(slot: string): string[] {
  return slot
    .toUpperCase()
    .split("+")
    .map((s) => s.trim())
    .filter((s) => s && s !== "NIL");
}

/** Sorted and de-duplicated, so equal plans compare equal in the database. */
export function normaliseClassIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim().toUpperCase()))].sort();
}

export function validatePlan(
  input: unknown,
  semesterId: string,
  offerings: ReadonlyMap<string, FfcsOffering>
): PlanValidation {
  if (!Array.isArray(input) || input.some((v) => typeof v !== "string")) {
    return { ok: false, error: "invalid_plan", detail: "classIds must be an array of strings" };
  }
  const classIds = normaliseClassIds(input as string[]);
  if (!classIds.length) {
    return { ok: false, error: "empty_plan", detail: "A plan needs at least one class" };
  }
  if (classIds.length > MAX_PLAN_CLASSES) {
    return {
      ok: false,
      error: "plan_too_large",
      detail: `A plan can have at most ${MAX_PLAN_CLASSES} classes`,
    };
  }

  const malformed = classIds.filter((id) => !CLASS_ID_RE.test(id));
  if (malformed.length) {
    return { ok: false, error: "invalid_class_id", detail: "Malformed class id", offending: malformed };
  }
  const otherSemester = classIds.filter((id) => !id.startsWith(semesterId));
  if (otherSemester.length) {
    return {
      ok: false,
      error: "semester_mismatch",
      detail: `Class ids must belong to ${semesterId}`,
      offending: otherSemester,
    };
  }
  const unknown = classIds.filter((id) => !offerings.has(id));
  if (unknown.length) {
    return {
      ok: false,
      error: "class_not_offered",
      detail: "Not in this semester's registration report",
      offending: unknown,
    };
  }

  const byComponent = new Map<string, string>();
  const bySlot = new Map<string, string>();
  for (const id of classIds) {
    const o = offerings.get(id)!;
    const component = `${o.code}|${o.type}`;
    const prior = byComponent.get(component);
    if (prior) {
      return {
        ok: false,
        error: "duplicate_course",
        detail: `Two sections of ${o.code} (${o.type})`,
        offending: [prior, id],
      };
    }
    byComponent.set(component, id);

    for (const token of slotTokens(o.slot)) {
      const clash = bySlot.get(token);
      if (clash) {
        return {
          ok: false,
          error: "slot_clash",
          detail: `Slot ${token} is taken twice`,
          offending: [clash, id],
        };
      }
      bySlot.set(token, id);
    }
  }

  return { ok: true, classIds };
}

/** Another participant whose classes overlap the caller's, as stored. */
export type MatchCandidate = {
  handle: string;
  name: string;
  source: MatchSource;
  classIds: readonly string[];
  updatedAt: string;
};

/** What the caller may see about another person: nothing that identifies them beyond the name. */
export type MatchPerson = { handle: string; name: string; source: MatchSource };

export type SectionMatch = {
  classId: string;
  offering: FfcsOffering | null;
  people: MatchPerson[];
};

export type OverlapMatch = MatchPerson & {
  shared: number;
  sharedClassIds: string[];
  /** Same set of classes as the caller: the "identical timetable" match. */
  identical: boolean;
  updatedAt: string;
};

export type MatchResult = { sections: SectionMatch[]; overlaps: OverlapMatch[] };

/**
 * One row per caller class (empty `people` included, so the UI can say "no one
 * yet"), plus everyone sharing two or more classes, ranked by how many.
 * `candidates` is expected to exclude the caller.
 */
export function computeMatches(
  mine: readonly string[],
  candidates: readonly MatchCandidate[],
  offerings: ReadonlyMap<string, FfcsOffering>
): MatchResult {
  const myIds = normaliseClassIds(mine);
  const mySet = new Set(myIds);
  const byClass = new Map<string, MatchPerson[]>(myIds.map((id) => [id, []]));
  const overlaps: OverlapMatch[] = [];

  for (const c of candidates) {
    const theirs = normaliseClassIds(c.classIds);
    const shared = theirs.filter((id) => mySet.has(id));
    if (!shared.length) continue;
    const person: MatchPerson = { handle: c.handle, name: c.name, source: c.source };
    for (const id of shared) byClass.get(id)!.push(person);

    const identical = shared.length === myIds.length && theirs.length === myIds.length;
    if (shared.length >= 2 || identical) {
      overlaps.push({ ...person, shared: shared.length, sharedClassIds: shared, identical, updatedAt: c.updatedAt });
    }
  }

  const byName = (a: MatchPerson, b: MatchPerson) => a.name.localeCompare(b.name);
  overlaps.sort(
    (a, b) => Number(b.identical) - Number(a.identical) || b.shared - a.shared || byName(a, b)
  );

  return {
    sections: myIds.map((classId) => ({
      classId,
      offering: offerings.get(classId) ?? null,
      people: byClass.get(classId)!.sort(byName),
    })),
    overlaps: overlaps.slice(0, MAX_OVERLAPS),
  };
}
