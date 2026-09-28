/**
 * Server-side mirror of the social timetable wire types.
 * Kept in step with `AmazeCC/src/lib/social/types.ts`.
 * Contract: docs/social-tt/07-api-contract.md
 */

export type SocialVisibility = "coarse" | "full";

/** One occupied slot. A `coarse` grant is served as `{}` — keys only. */
export type BusyEntry = {
  c?: string;
  t?: string;
  v?: string;
};

/** Keyed `"DAY:SLOTID"`. */
export type BusyMap = Record<string, BusyEntry>;

export type SocialCourse = {
  code: string;
  title: string;
  venue: string;
  /** Raw `"L T P J C"` column, e.g. "0 0 4 0 2.0". */
  ltpjc: string;
  /**
   * The `Category` COLUMN, which is a course taxonomy, not a component type:
   * "University Core Courses", "Programme Core Courses", …
   */
  category: string;
  /**
   * The component type from the parenthesised suffix of the `Course` cell:
   * "Lab Only", "Embedded Theory", "Embedded Lab", "Theory Only".
   *
   * This — not `category`, and not whether a slot id begins with "L" — is the
   * authoritative theory/lab discriminator. A course appears once per component,
   * so the same `code` can be Embedded Theory on one row and Embedded Lab on
   * another, with different class ids and venues.
   */
  componentType: string;
  /** VTOP class id, e.g. "CH2026270102069" — embeds the semester code. */
  classId: string;
  faculty: string;
};

export type ParsedSemesterOption = {
  value: string;
  text: string;
  selected: boolean;
};

export type SemesterResolution = {
  semesterId: string;
  semesterLabel: string;
  /** Which rule fired, so a surprising value is explainable in the log. */
  source: "proposed_validated" | "first_available" | "selected_option";
  optionCount: number;
};

/**
 * A peer's record older than this is badged as stale. It is not neutral
 * information: someone who dropped a class still reads as busy until they sync,
 * so a comparison built on it can be actively wrong.
 */
export const STALE_AFTER_DAYS = 14;

/**
 * Strip `c`/`t`/`v` from a busy map for a `coarse` grant.
 *
 * The slot KEYS are deliberately kept — occupancy is the whole point of the
 * feature. Only the identifying detail goes, and it is dropped here on the
 * server rather than in the client, so a coarse peer is never serialised with
 * the course data attached in the first place.
 */
export function toCoarse(busyMap: BusyMap): BusyMap {
  const out: BusyMap = {};
  for (const key of Object.keys(busyMap)) out[key] = {};
  return out;
}
