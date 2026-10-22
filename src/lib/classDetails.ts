/**
 * Class details: the facts of a class, contributed once per student per semester.
 *
 * ## What this is
 *
 * A row per class, holding everything VTOP's timetable says about it — the
 * course code and title, the credits, the component, the slots it runs in, the
 * room it runs in and the faculty who teach it. Attendance percentages and
 * marks are deliberately *not* here: the source this is derived from is the
 * timetable fetch, which never carried them, and nothing in this file could
 * write one even if it wanted to.
 *
 * ## Why it exists
 *
 * No single student sees the whole campus timetable. A student knows the rooms
 * of their own courses and nothing else. Aggregated across every student who
 * syncs, their timetables cover the campus, and the union is a map of which
 * room is taken when — which is what a free-room finder needs, and what a
 * hand-maintained FFCS spreadsheet cannot be: that file records what was booked
 * during registration, so a rescheduled lab, a room change or a cancelled
 * section never reaches it.
 *
 * ## How a class gets here
 *
 * The contribution rides on the attendance fetch, which already resolves the
 * caller's identity from VTOP's own response and already has the timetable in
 * hand — so it costs no extra VTOP call and no new client code. The caller is
 * hashed into an `owner_key`, and one row in `class_sync_state` records that
 * this student has already contributed for this semester. That row is the gate:
 * the timetable barely changes after it is set, so the second sync of the term
 * is a no-op rather than a rewrite.
 *
 * ## What is not stored
 *
 * No registration number, in any form. `owner_key` is `maskUserID(regNo)` — an
 * HMAC under a server-only salt — and it exists solely to make the contribution
 * idempotent. The read path never returns it.
 */

import type { PoolClient } from "pg";
import { getDbPool } from "./db";
import { parseCourseCell, splitSlotVenue } from "./socialTimetable";
import { canonicalSlotIds } from "./slotSpellings";
import type { courseItem } from "@/types/data/attendance";

export const CLASS_DETAILS_TABLE = "class_details";
export const CLASS_SYNC_STATE_TABLE = "class_sync_state";
export const ROOMS_TABLE = "rooms";

/** Venues that are not a room on campus. */
const NOT_A_ROOM = new Set(["NIL", "N/A", "UNK-UNK", "-", ""]);

export type RoomKind = "theory" | "lab";

export type ClassDetailRow = {
  /** VTOP's class number. Stable for the life of the section. */
  classId: string;
  courseCode: string;
  courseTitle: string;
  ltpjc: string;
  category: string;
  /** `theory` | `lab` | `""` when VTOP does not say. */
  component: string;
  /** The slot string as VTOP wrote it, e.g. `"A+TA+TAA"`. */
  slotRaw: string;
  /** The same slots in the vocabulary's spelling, e.g. `["A1","TA1","TAA1"]`. */
  slotIds: string[];
  venue: string;
  faculty: string;
};

export type StoredClass = ClassDetailRow & { semesterId: string };

export type RoomRecord = {
  code: string;
  block: string;
  kind: RoomKind;
};

/* ── schema ────────────────────────────────────────────────────────────────── */

let schemaEnsured: Promise<void> | null = null;

/**
 * The three tables this feature owns.
 *
 * Inline DDL on first use, following the convention already used by
 * `marks/sync` and `cabshare/auth`: this repo has no migrations directory, so
 * the schema only exists in production once a route has actually been hit.
 */
export function ensureClassSchema(): Promise<void> {
  if (!schemaEnsured) {
    schemaEnsured = (async () => {
      const pool = getDbPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${CLASS_DETAILS_TABLE} (
          semester_id  TEXT NOT NULL,
          class_id     TEXT NOT NULL,
          course_code  TEXT NOT NULL DEFAULT '',
          course_title TEXT NOT NULL DEFAULT '',
          ltpjc        TEXT NOT NULL DEFAULT '',
          category     TEXT NOT NULL DEFAULT '',
          component    TEXT NOT NULL DEFAULT '',
          slot_raw     TEXT NOT NULL DEFAULT '',
          slot_ids     TEXT[] NOT NULL DEFAULT '{}'::text[],
          venue        TEXT NOT NULL DEFAULT '',
          faculty      TEXT NOT NULL DEFAULT '',
          updated_at   BIGINT NOT NULL,
          PRIMARY KEY (semester_id, class_id)
        );
        CREATE TABLE IF NOT EXISTS ${CLASS_SYNC_STATE_TABLE} (
          owner_key   TEXT NOT NULL,
          semester_id TEXT NOT NULL,
          synced_at   BIGINT NOT NULL,
          PRIMARY KEY (owner_key, semester_id)
        );
        CREATE TABLE IF NOT EXISTS ${ROOMS_TABLE} (
          venue TEXT PRIMARY KEY,
          block TEXT NOT NULL DEFAULT 'Other',
          kind  TEXT NOT NULL DEFAULT 'theory'
        );
        CREATE INDEX IF NOT EXISTS class_details_semester_venue
          ON ${CLASS_DETAILS_TABLE} (semester_id, venue);
      `);
    })().catch((err: unknown) => {
      // A transient failure must not poison the memo for the life of the instance.
      schemaEnsured = null;
      throw err;
    });
  }
  return schemaEnsured;
}

/* ── derivation ────────────────────────────────────────────────────────────── */

/**
 * The venue as a room code, or an empty string when it names no room.
 *
 * Trimmed and upper-cased: six venues in the FFCS report carry a trailing
 * space, and without the trim `"AB3 "` and `"AB3"` become two rooms — which
 * split the counts and gave the filter two entries for one building.
 */
export function cleanVenue(raw: string): string {
  const value = String(raw ?? "").trim().toUpperCase();
  if (!value || NOT_A_ROOM.has(value)) return "";
  if (value.includes("ONLINE")) return "";
  return value;
}

/** The block a room belongs to: everything before the first dash. */
export function blockOf(code: string): string {
  const trimmed = String(code ?? "").trim();
  const dash = trimmed.indexOf("-");
  if (dash <= 0) return "Other";
  return trimmed.slice(0, dash).trim() || "Other";
}

/**
 * Whether a class is a theory or a lab half.
 *
 * Three sources, in order of how much they can be trusted:
 *
 * 1. The `(L)`/`(T)` suffix VTOP's timetable puts on the course code — the
 *    server's own parser sets it from the slot, so it is the one that knows.
 * 2. The parenthesised component type of the course cell (`Lab Only`,
 *    `Embedded Theory`).
 * 3. The slots themselves: a slot that starts with `L` is a lab slot.
 */
export function componentOf(
  courseCode: string,
  componentType: string,
  slotIds: readonly string[]
): string {
  const code = String(courseCode ?? "").trim().toUpperCase();
  if (/\(L\)$/.test(code)) return "lab";
  if (/\(T\)$/.test(code)) return "theory";

  const type = String(componentType ?? "").trim().toLowerCase();
  if (type.includes("lab")) return "lab";
  if (type.includes("theory")) return "theory";

  if (slotIds.some((s) => s.startsWith("L"))) return "lab";
  return "";
}

/**
 * Turn one student's timetable into the class rows it contributes.
 *
 * Pure, so it is testable without a database — and it is where the messy parts
 * of the VTOP timetable live:
 *
 * - The course cell is `"BACSE102 - Problem Solving Using Java ( Lab Only )"`,
 *   which `parseCourseCell` splits into a code, a title and a component.
 * - The slot cell is `"L31+L32+L37+L38 - AB1-607B"`, which `splitSlotVenue`
 *   splits into slots and a venue. A bare `split("-")` would corrupt both.
 * - The slots are canonicalised into the vocabulary's spelling, because the law
 *   school's `A` is not a slot id and would otherwise be filed as running on no
 *   day at all.
 */
export function deriveClassDetails(
  courses: readonly courseItem[]
): ClassDetailRow[] {
  const rows: ClassDetailRow[] = [];
  const seen = new Set<string>();

  for (const course of courses) {
    const classId = String(course.classId ?? "").trim();
    if (!classId || seen.has(classId)) continue;
    seen.add(classId);

    const parsed = parseCourseCell(String(course.course ?? ""));
    const rawCode = String(course.courseCode ?? "").trim();
    const courseCode = parsed.code || rawCode.replace(/\((?:L|T)\)$/, "");
    const courseTitle = parsed.title || String(course.course ?? "").trim();

    const { slots, venue } = splitSlotVenue(String(course.slotVenue ?? ""));
    const slotIds = canonicalSlotIds(slots);

    rows.push({
      classId,
      courseCode,
      courseTitle,
      ltpjc: String(course.LTPJC ?? "").trim(),
      category: String(course.category ?? "").trim(),
      component: componentOf(rawCode, parsed.componentType, slotIds),
      slotRaw: slots.join("+"),
      slotIds,
      venue: cleanVenue(venue),
      faculty: String(course.facultyDetails ?? "").trim(),
    });
  }

  return rows;
}

/* ── write path ────────────────────────────────────────────────────────────── */

export type RecordOutcome = {
  /** False when the gate said this student already contributed this semester. */
  recorded: boolean;
  skipped: boolean;
  classes: number;
};

/**
 * Whether this student has already contributed for this semester.
 *
 * The cheap half of the gate, for callers that would otherwise parse a
 * timetable before finding out there is nothing to do with it. `recordClassDetails`
 * checks the same thing again inside the transaction, so this is a shortcut
 * rather than the gate itself.
 */
export async function alreadyContributed(
  ownerKey: string,
  semesterId: string
): Promise<boolean> {
  if (!ownerKey || !semesterId) return true;
  const pool = getDbPool();
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM ${CLASS_SYNC_STATE_TABLE}
        WHERE owner_key = $1 AND semester_id = $2`,
      [ownerKey, semesterId]
    );
    return rows.length > 0;
  } catch {
    // The table may not exist yet on a fresh database. That is not a reason to
    // skip the contribution — the write path creates it.
    return false;
  }
}

/**
 * Record one student's classes for one semester, once.
 *
 * The gate is `class_sync_state`: if this `(owner_key, semester_id)` is already
 * there, this student has contributed and nothing is written. The row is
 * inserted in the same transaction as the class rows, so a failure part-way
 * through leaves the semester un-contributed rather than half-contributed with
 * the gate closed.
 */
export async function recordClassDetails(
  ownerKey: string,
  semesterId: string,
  rows: readonly ClassDetailRow[],
  now: number
): Promise<RecordOutcome> {
  if (!ownerKey || !semesterId || rows.length === 0) {
    return { recorded: false, skipped: true, classes: 0 };
  }

  const pool = getDbPool();
  await ensureClassSchema();

  const { rows: existing } = await pool.query(
    `SELECT 1 FROM ${CLASS_SYNC_STATE_TABLE}
      WHERE owner_key = $1 AND semester_id = $2`,
    [ownerKey, semesterId]
  );
  if (existing.length > 0) {
    return { recorded: false, skipped: true, classes: 0 };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const row of rows) {
      await upsertClass(client, semesterId, row, now);
    }

    await growRoomInventory(client, rows);

    await client.query(
      `INSERT INTO ${CLASS_SYNC_STATE_TABLE} (owner_key, semester_id, synced_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (owner_key, semester_id)
       DO UPDATE SET synced_at = EXCLUDED.synced_at`,
      [ownerKey, semesterId, now]
    );

    await client.query("COMMIT");
    return { recorded: true, skipped: false, classes: rows.length };
  } catch (err: unknown) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function upsertClass(
  client: PoolClient,
  semesterId: string,
  row: ClassDetailRow,
  now: number
): Promise<void> {
  await client.query(
    `INSERT INTO ${CLASS_DETAILS_TABLE}
       (semester_id, class_id, course_code, course_title, ltpjc, category,
        component, slot_raw, slot_ids, venue, faculty, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, $11, $12)
     ON CONFLICT (semester_id, class_id) DO UPDATE SET
       course_code  = EXCLUDED.course_code,
       course_title = EXCLUDED.course_title,
       ltpjc        = EXCLUDED.ltpjc,
       category     = EXCLUDED.category,
       component    = EXCLUDED.component,
       slot_raw     = EXCLUDED.slot_raw,
       slot_ids     = EXCLUDED.slot_ids,
       venue        = EXCLUDED.venue,
       faculty      = EXCLUDED.faculty,
       updated_at   = EXCLUDED.updated_at`,
    [
      semesterId,
      row.classId,
      row.courseCode,
      row.courseTitle,
      row.ltpjc,
      row.category,
      row.component,
      row.slotRaw,
      row.slotIds,
      row.venue,
      row.faculty,
      now,
    ]
  );
}

/**
 * Add any room the contribution mentions to the inventory.
 *
 * `ON CONFLICT DO NOTHING` on purpose: the inventory is seeded from the FFCS
 * report, which knows a room's kind far better than one class can, and a room
 * that is already listed keeps the kind it was listed with.
 */
async function growRoomInventory(
  client: PoolClient,
  rows: readonly ClassDetailRow[]
): Promise<void> {
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (!row.venue) continue;
    if (seen.has(row.venue)) continue;
    seen.set(row.venue, row.component === "lab" ? "lab" : "theory");
  }
  for (const [venue, kind] of seen) {
    await client.query(
      `INSERT INTO ${ROOMS_TABLE} (venue, block, kind)
       VALUES ($1, $2, $3)
       ON CONFLICT (venue) DO NOTHING`,
      [venue, blockOf(venue), kind]
    );
  }
}

/* ── read path ─────────────────────────────────────────────────────────────── */

/** Every class recorded for a semester. */
export async function loadClassDetails(
  semesterId: string
): Promise<StoredClass[]> {
  if (!semesterId) return [];
  const pool = getDbPool();
  const { rows } = await pool.query(
    `SELECT semester_id, class_id, course_code, course_title, ltpjc, category,
            component, slot_raw, slot_ids, venue, faculty
       FROM ${CLASS_DETAILS_TABLE}
      WHERE semester_id = $1
      ORDER BY class_id`,
    [semesterId]
  );
  return rows.map((r: Record<string, unknown>) => ({
    semesterId: String(r.semester_id),
    classId: String(r.class_id),
    courseCode: String(r.course_code ?? ""),
    courseTitle: String(r.course_title ?? ""),
    ltpjc: String(r.ltpjc ?? ""),
    category: String(r.category ?? ""),
    component: String(r.component ?? ""),
    slotRaw: String(r.slot_raw ?? ""),
    slotIds: Array.isArray(r.slot_ids) ? (r.slot_ids as string[]) : [],
    venue: String(r.venue ?? ""),
    faculty: String(r.faculty ?? ""),
  }));
}

/** The room inventory: every room the campus is known to have. */
export async function loadRooms(): Promise<RoomRecord[]> {
  const pool = getDbPool();
  const { rows } = await pool.query(
    `SELECT venue, block, kind FROM ${ROOMS_TABLE} ORDER BY venue`
  );
  return rows.map((r: Record<string, unknown>) => ({
    code: String(r.venue),
    block: String(r.block ?? "Other"),
    kind: (String(r.kind ?? "theory") === "lab" ? "lab" : "theory") as RoomKind,
  }));
}
