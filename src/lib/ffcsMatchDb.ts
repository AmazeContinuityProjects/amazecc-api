import { getDbPool } from "./db";
import { PERSON_TABLE } from "./socialDb";
import { MAX_CHANGES_PER_DAY, type MatchCandidate, type MatchSource } from "./ffcsMatch";

/**
 * Persistence for the FFCS friend finder.
 *
 * One row per (person, semester). Identity lives in `social_people`, which is
 * keyed by the same masked registration number and already holds the VTOP
 * display name and the public handle. This table stores only the class ids
 * and the opt-in flag, so no plaintext registration number is stored here.
 *
 * Inline DDL, following `socialDb.ts` (this repo has no migrations).
 */

export const FFCS_MATCH_TABLE = "ffcs_match_entries";

let schemaReady: Promise<void> | null = null;

export function ensureFfcsMatchSchema(): Promise<void> {
  schemaReady ??= (async () => {
    const pool = getDbPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${FFCS_MATCH_TABLE} (
        owner_key          TEXT NOT NULL,
        semester_id        TEXT NOT NULL,
        class_ids          TEXT[] NOT NULL DEFAULT '{}',
        source             TEXT NOT NULL CHECK (source IN ('planned', 'registered')),
        discoverable       BOOLEAN NOT NULL DEFAULT TRUE,
        changes_in_window  INTEGER NOT NULL DEFAULT 0,
        window_started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (owner_key, semester_id)
      )
    `);
    // Overlap lookups (`class_ids && $1`) use this.
    await pool.query(
      `CREATE INDEX IF NOT EXISTS ${FFCS_MATCH_TABLE}_class_ids_gin
         ON ${FFCS_MATCH_TABLE} USING GIN (class_ids)`
    );
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

export type FfcsMatchEntry = {
  classIds: string[];
  source: MatchSource;
  discoverable: boolean;
  changesInWindow: number;
  windowStartedAt: string;
  updatedAt: string;
};

function toEntry(r: Record<string, unknown>): FfcsMatchEntry {
  return {
    classIds: (r.class_ids as string[]) ?? [],
    source: r.source as MatchSource,
    discoverable: Boolean(r.discoverable),
    changesInWindow: Number(r.changes_in_window),
    windowStartedAt: new Date(r.window_started_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

const ENTRY_COLUMNS = "class_ids, source, discoverable, changes_in_window, window_started_at, updated_at";

export async function getEntry(ownerKey: string, semesterId: string): Promise<FfcsMatchEntry | null> {
  const { rows } = await getDbPool().query(
    `SELECT ${ENTRY_COLUMNS} FROM ${FFCS_MATCH_TABLE} WHERE owner_key = $1 AND semester_id = $2`,
    [ownerKey, semesterId]
  );
  return rows.length ? toEntry(rows[0]) : null;
}

/**
 * Write the caller's classes. Returns `null` when the daily change cap is hit.
 *
 * The cap is enforced inside the one statement: the `WHERE` on the conflict
 * branch refuses the update outright, so two concurrent publishes cannot
 * both slip under the limit. Re-publishing the same classes from the same
 * source is free, so re-opening the page never uses up a change.
 */
export async function publishEntry(
  ownerKey: string,
  semesterId: string,
  classIds: string[],
  source: MatchSource,
  discoverable: boolean
): Promise<FfcsMatchEntry | null> {
  const t = FFCS_MATCH_TABLE;
  const expired = `${t}.window_started_at < NOW() - INTERVAL '24 hours'`;
  const unchanged = `(${t}.class_ids = EXCLUDED.class_ids AND ${t}.source = EXCLUDED.source)`;
  const { rows } = await getDbPool().query(
    `INSERT INTO ${t} (owner_key, semester_id, class_ids, source, discoverable, changes_in_window)
     VALUES ($1, $2, $3::text[], $4, $5, 1)
     ON CONFLICT (owner_key, semester_id) DO UPDATE SET
       class_ids         = EXCLUDED.class_ids,
       source            = EXCLUDED.source,
       discoverable      = EXCLUDED.discoverable,
       updated_at        = CASE WHEN ${unchanged} THEN ${t}.updated_at ELSE NOW() END,
       changes_in_window = CASE WHEN ${expired} THEN 1
                                WHEN ${unchanged} THEN ${t}.changes_in_window
                                ELSE ${t}.changes_in_window + 1 END,
       window_started_at = CASE WHEN ${expired} THEN NOW() ELSE ${t}.window_started_at END
     WHERE ${expired} OR ${unchanged} OR ${t}.changes_in_window < $6
     RETURNING ${ENTRY_COLUMNS}`,
    [ownerKey, semesterId, classIds, source, discoverable, MAX_CHANGES_PER_DAY]
  );
  return rows.length ? toEntry(rows[0]) : null;
}

export async function setDiscoverable(
  ownerKey: string,
  semesterId: string,
  discoverable: boolean
): Promise<FfcsMatchEntry | null> {
  const { rows } = await getDbPool().query(
    `UPDATE ${FFCS_MATCH_TABLE} SET discoverable = $3
      WHERE owner_key = $1 AND semester_id = $2
      RETURNING ${ENTRY_COLUMNS}`,
    [ownerKey, semesterId, discoverable]
  );
  return rows.length ? toEntry(rows[0]) : null;
}

export async function deleteEntry(ownerKey: string, semesterId: string): Promise<boolean> {
  const { rowCount } = await getDbPool().query(
    `DELETE FROM ${FFCS_MATCH_TABLE} WHERE owner_key = $1 AND semester_id = $2`,
    [ownerKey, semesterId]
  );
  return (rowCount ?? 0) > 0;
}

/** Upper bound on rows read per match. A section seats about 70, so this only bites on abuse. */
const MAX_CANDIDATES = 3000;

/**
 * Discoverable people (not the caller) who share at least one class.
 *
 * The owner key never leaves this function. The caller sees handles and names.
 */
export async function findCandidates(
  ownerKey: string,
  semesterId: string,
  classIds: string[]
): Promise<MatchCandidate[]> {
  if (!classIds.length) return [];
  const { rows } = await getDbPool().query(
    `SELECT p.handle, p.display_name, e.source, e.class_ids, e.updated_at
       FROM ${FFCS_MATCH_TABLE} e
       JOIN ${PERSON_TABLE} p ON p.owner_key = e.owner_key
      WHERE e.semester_id = $1
        AND e.owner_key <> $2
        AND e.discoverable
        AND e.class_ids && $3::text[]
      LIMIT ${MAX_CANDIDATES}`,
    [semesterId, ownerKey, classIds]
  );
  return rows.map((r) => ({
    handle: r.handle as string,
    name: (r.display_name as string) || "",
    source: r.source as MatchSource,
    classIds: r.class_ids as string[],
    updatedAt: new Date(r.updated_at as string).toISOString(),
  }));
}

/** How many people have joined this semester: shown as social proof, reveals no one. */
export async function countParticipants(semesterId: string): Promise<number> {
  const { rows } = await getDbPool().query(
    `SELECT COUNT(*)::int AS n FROM ${FFCS_MATCH_TABLE} WHERE semester_id = $1 AND discoverable`,
    [semesterId]
  );
  return Number(rows[0]?.n ?? 0);
}
