import { getDbPool } from "./db";
import { maskUserID } from "./mask";
import type { BusyMap, SocialCourse } from "./socialTypes";

/**
 * Persistence for the social timetable feature.
 *
 * DDL is created inline on first use, following the convention already used by
 * `marks/sync` and `cabshare/auth`. This repo has no migrations directory and
 * no `db:push` script, so inline DDL is the house style — and it also means
 * the schema only exists in production once a route has actually been hit.
 *
 * `owner_key` is `maskUserID(registerNo)`: a keyed, one-way pseudonym, so no
 * plaintext registration number is stored in any table this feature creates.
 */

export const PERSON_TABLE = "social_people";
export const TIMETABLE_TABLE = "social_timetables";
export const SEMESTER_CONFIG_KEY = "social_current_semester";

/** Upper-cased before hashing so the key is stable across input casing. */
export function ownerKeyFor(regNumber: string): string {
  return maskUserID(regNumber.trim().toUpperCase());
}

export async function ensureSchema(): Promise<void> {
  const pool = getDbPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${PERSON_TABLE} (
      owner_key     TEXT PRIMARY KEY,
      handle        TEXT UNIQUE NOT NULL,
      display_name  TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TIMETABLE_TABLE} (
      owner_key         TEXT NOT NULL,
      semester_id       TEXT NOT NULL,
      version           INTEGER NOT NULL DEFAULT 1,
      busy_map          JSONB NOT NULL DEFAULT '{}'::jsonb,
      courses           JSONB NOT NULL DEFAULT '[]'::jsonb,
      slotmap_version   TEXT NOT NULL,
      published_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      client_updated_at TIMESTAMPTZ,
      PRIMARY KEY (owner_key, semester_id)
    )
  `);
}

// Crockford-ish alphabet: no I, L, O, U, so codes are unambiguous when read
// aloud or typed from a screenshot.
const HANDLE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomHandle(): string {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (const b of bytes) out += HANDLE_ALPHABET[b % HANDLE_ALPHABET.length];
  return `AMZ-${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

/**
 * Upsert the person row, minting a handle on first sight.
 *
 * The handle is NOT derived from the registration number: a masked reg number
 * is irreversible and a reversible one would leak identity through a value
 * designed to be shown on a projector. A unique violation is the only
 * expected failure and is retried, not surfaced.
 */
export async function upsertPerson(
  ownerKey: string,
  displayName: string
): Promise<{ handle: string; created: boolean }> {
  const pool = getDbPool();

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO ${PERSON_TABLE} (owner_key, handle, display_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (owner_key) DO UPDATE
           SET display_name = EXCLUDED.display_name,
               updated_at = NOW()
         RETURNING handle, (created_at = updated_at) AS fresh`,
        [ownerKey, randomHandle(), displayName]
      );
      return { handle: rows[0].handle as string, created: Boolean(rows[0].fresh) };
    } catch (err: unknown) {
      // 23505 = unique_violation on handle
      const code = (err as { code?: string })?.code;
      if (code === "23505" && attempt < 5) continue;
      throw err;
    }
  }
  throw new Error("Could not allocate a unique handle after 6 attempts");
}

export async function getPerson(ownerKey: string): Promise<{
  handle: string;
  displayName: string | null;
} | null> {
  const pool = getDbPool();
  const { rows } = await pool.query(
    `SELECT handle, display_name FROM ${PERSON_TABLE} WHERE owner_key = $1`,
    [ownerKey]
  );
  if (!rows.length) return null;
  return { handle: rows[0].handle as string, displayName: rows[0].display_name ?? null };
}

export type StoredTimetable = {
  semesterId: string;
  version: number;
  busyMap: BusyMap;
  courses: SocialCourse[];
  slotmapVersion: string;
  publishedAt: string;
};

/**
 * Write the caller's own timetable for one semester.
 *
 * The row is keyed `(owner_key, semester_id)`, so republishing the same term
 * overwrites cleanly and a mid-term slot change versions rather than
 * accumulating. Bumping `version` lets readers skip a re-render.
 */
export async function upsertTimetable(
  ownerKey: string,
  semesterId: string,
  busyMap: BusyMap,
  courses: SocialCourse[],
  slotmapVersion: string,
  clientUpdatedAt?: string | null
): Promise<{ version: number; publishedAt: string }> {
  const pool = getDbPool();
  const { rows } = await pool.query(
    `INSERT INTO ${TIMETABLE_TABLE}
       (owner_key, semester_id, busy_map, courses, slotmap_version, client_updated_at)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
     ON CONFLICT (owner_key, semester_id) DO UPDATE SET
       busy_map          = EXCLUDED.busy_map,
       courses           = EXCLUDED.courses,
       slotmap_version   = EXCLUDED.slotmap_version,
       client_updated_at = EXCLUDED.client_updated_at,
       version           = ${TIMETABLE_TABLE}.version + 1,
       published_at      = NOW()
     RETURNING version, published_at`,
    [
      ownerKey,
      semesterId,
      JSON.stringify(busyMap),
      JSON.stringify(courses),
      slotmapVersion,
      clientUpdatedAt ?? null,
    ]
  );
  return {
    version: Number(rows[0].version),
    publishedAt: new Date(rows[0].published_at as string).toISOString(),
  };
}

export async function getTimetable(
  ownerKey: string,
  semesterId: string
): Promise<StoredTimetable | null> {
  const pool = getDbPool();
  const { rows } = await pool.query(
    `SELECT semester_id, version, busy_map, courses, slotmap_version, published_at
       FROM ${TIMETABLE_TABLE}
      WHERE owner_key = $1 AND semester_id = $2`,
    [ownerKey, semesterId]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    semesterId: r.semester_id as string,
    version: Number(r.version),
    busyMap: r.busy_map as BusyMap,
    courses: r.courses as SocialCourse[],
    slotmapVersion: r.slotmap_version as string,
    publishedAt: new Date(r.published_at as string).toISOString(),
  };
}

/** Cache the campus-wide current semester so 200 students do not scrape 200×. */
export async function cacheCurrentSemester(value: {
  semesterId: string;
  label: string;
}): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS app_config (
       key        TEXT PRIMARY KEY,
       value      JSONB NOT NULL DEFAULT '{}'::jsonb,
       updated_at TIMESTAMPTZ DEFAULT now()
     )`
  );
  await pool.query(
    `INSERT INTO app_config (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [SEMESTER_CONFIG_KEY, JSON.stringify({ ...value, resolvedAt: new Date().toISOString() })]
  );
}

export async function getCachedSemester(): Promise<{
  semesterId: string;
  label: string;
} | null> {
  const pool = getDbPool();
  const { rows } = await pool.query(
    `SELECT value FROM app_config WHERE key = $1`,
    [SEMESTER_CONFIG_KEY]
  );
  if (!rows.length) return null;
  const v = rows[0].value as { semesterId?: string; label?: string };
  if (!v?.semesterId) return null;
  return { semesterId: v.semesterId, label: v.label ?? "" };
}
