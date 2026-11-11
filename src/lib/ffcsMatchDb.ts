import { getDbPool } from "./db";
import { PERSON_TABLE } from "./socialDb";
import { MAX_CHANGES_PER_DAY, type MatchCandidate, type MatchSource } from "./ffcsMatch";
import type { FfcsOffering } from "./ffcsReport";

/**
 * Persistence for the FFCS friend finder.
 *
 * One row per (person, semester). Identity lives in `social_people`, which is
 * keyed by the same masked registration number and already holds the VTOP
 * display name and the public handle. This table stores only the class ids
 * and the opt-in flag, so no plaintext registration number is stored here,
 * except `register_no`, shown only to reciprocal overlap sharers (decision D3).
 *
 * Inline DDL, following `socialDb.ts` (this repo has no migrations).
 */

export const FFCS_MATCH_TABLE = "ffcs_match_entries";
export const FFCS_CLASSES_TABLE = "ffcs_classes";
export const FFCS_CLASS_REGISTRATIONS_TABLE = "ffcs_class_registrations";

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
    await pool.query(`
      ALTER TABLE ${FFCS_MATCH_TABLE}
        ADD COLUMN IF NOT EXISTS register_no TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
    `);
    await pool.query(`
      DELETE FROM ${FFCS_MATCH_TABLE} WHERE source = 'planned';
    `);

    // Ensure uniqueness for (semester_id, register_no)
    await pool.query(`
      DELETE FROM ${FFCS_MATCH_TABLE} a USING ${FFCS_MATCH_TABLE} b
       WHERE a.semester_id = b.semester_id
         AND UPPER(a.register_no) = UPPER(b.register_no)
         AND a.register_no <> ''
         AND a.updated_at < b.updated_at;
    `);

    // Deduplicate stale app-number / non-proper entries when a proper regNo exists for the same student
    await pool.query(`
      DELETE FROM ${FFCS_MATCH_TABLE} a USING ${FFCS_MATCH_TABLE} b
       WHERE a.semester_id = b.semester_id
         AND a.owner_key <> b.owner_key
         AND UPPER(TRIM(a.display_name)) = UPPER(TRIM(b.display_name))
         AND a.display_name <> ''
         AND b.register_no ~* '^[0-9]{2}[A-Z]{3}[0-9]{4,5}$'
         AND NOT (a.register_no ~* '^[0-9]{2}[A-Z]{3}[0-9]{4,5}$');
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${FFCS_MATCH_TABLE}_sem_reg_unique
        ON ${FFCS_MATCH_TABLE} (semester_id, register_no)
        WHERE register_no <> '';
    `);

    // Master class catalog table with registered student reg numbers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${FFCS_CLASSES_TABLE} (
        semester_id   TEXT NOT NULL,
        class_id      TEXT NOT NULL,
        course_code   TEXT NOT NULL DEFAULT '',
        course_title  TEXT NOT NULL DEFAULT '',
        course_type   TEXT NOT NULL DEFAULT '',
        slot          TEXT NOT NULL DEFAULT '',
        faculty       TEXT NOT NULL DEFAULT '',
        credits       TEXT NOT NULL DEFAULT '',
        room          TEXT NOT NULL DEFAULT '',
        register_nos  TEXT[] NOT NULL DEFAULT '{}',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (semester_id, class_id)
      );
      CREATE INDEX IF NOT EXISTS ${FFCS_CLASSES_TABLE}_sem_class_idx
        ON ${FFCS_CLASSES_TABLE} (semester_id, class_id);
    `);

    // Class registrations roster table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${FFCS_CLASS_REGISTRATIONS_TABLE} (
        semester_id   TEXT NOT NULL,
        class_id      TEXT NOT NULL,
        register_no   TEXT NOT NULL,
        display_name  TEXT NOT NULL DEFAULT '',
        handle        TEXT NOT NULL DEFAULT '',
        owner_key     TEXT NOT NULL,
        discoverable  BOOLEAN NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (semester_id, class_id, register_no)
      );
      CREATE INDEX IF NOT EXISTS ${FFCS_CLASS_REGISTRATIONS_TABLE}_sem_reg_idx
        ON ${FFCS_CLASS_REGISTRATIONS_TABLE} (semester_id, register_no);
      CREATE INDEX IF NOT EXISTS ${FFCS_CLASS_REGISTRATIONS_TABLE}_sem_class_idx
        ON ${FFCS_CLASS_REGISTRATIONS_TABLE} (semester_id, class_id);
    `);
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
  registerNo: string;
  displayName: string;
};

function toEntry(r: Record<string, unknown>): FfcsMatchEntry {
  return {
    classIds: (r.class_ids as string[]) ?? [],
    source: r.source as MatchSource,
    discoverable: Boolean(r.discoverable),
    changesInWindow: Number(r.changes_in_window),
    windowStartedAt: new Date(r.window_started_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
    registerNo: (r.register_no as string) ?? "",
    displayName: (r.display_name as string) ?? "",
  };
}

const ENTRY_COLUMNS = "class_ids, source, discoverable, register_no, display_name, changes_in_window, window_started_at, updated_at";

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
  discoverable: boolean,
  regNo: string = "",
  displayName: string = ""
): Promise<FfcsMatchEntry | null> {
  const pool = getDbPool();
  const cleanRegNo = regNo.trim().toUpperCase();
  const cleanName = displayName.trim();
  const isProperReg = /^[0-9]{2}[A-Z]{3}[0-9]{4,5}$/i.test(cleanRegNo);

  if (cleanRegNo) {
    // Uniqueness: remove any other registration under this regNo for this semester
    await pool.query(
      `DELETE FROM ${FFCS_MATCH_TABLE}
        WHERE semester_id = $1 AND UPPER(register_no) = $2 AND owner_key <> $3`,
      [semesterId, cleanRegNo, ownerKey]
    );

    // If caller has a proper registration number and display name, purge any stale
    // application-number / non-proper reg row for the same student in this semester
    if (isProperReg && cleanName) {
      await pool.query(
        `DELETE FROM ${FFCS_MATCH_TABLE}
          WHERE semester_id = $1
            AND owner_key <> $2
            AND UPPER(TRIM(display_name)) = UPPER($3)
            AND NOT (register_no ~* '^[0-9]{2}[A-Z]{3}[0-9]{4,5}$')`,
        [semesterId, ownerKey, cleanName]
      );
    }
  }

  const t = FFCS_MATCH_TABLE;
  const expired = `${t}.window_started_at < NOW() - INTERVAL '24 hours'`;
  const unchanged = `(${t}.class_ids = EXCLUDED.class_ids AND ${t}.source = EXCLUDED.source)`;
  const { rows } = await pool.query(
    `INSERT INTO ${t} (owner_key, semester_id, class_ids, source, discoverable, register_no, display_name, changes_in_window)
     VALUES ($1, $2, $3::text[], $4, $5, $6, $7, 1)
     ON CONFLICT (owner_key, semester_id) DO UPDATE SET
       class_ids         = EXCLUDED.class_ids,
       source            = EXCLUDED.source,
       discoverable      = EXCLUDED.discoverable,
       register_no       = CASE WHEN EXCLUDED.register_no <> '' THEN EXCLUDED.register_no ELSE ${t}.register_no END,
       display_name      = CASE WHEN EXCLUDED.display_name <> '' THEN EXCLUDED.display_name ELSE ${t}.display_name END,
       updated_at        = CASE WHEN ${unchanged} THEN ${t}.updated_at ELSE NOW() END,
       changes_in_window = CASE WHEN ${expired} THEN 1
                                WHEN ${unchanged} THEN ${t}.changes_in_window
                                ELSE ${t}.changes_in_window + 1 END,
       window_started_at = CASE WHEN ${expired} THEN NOW() ELSE ${t}.window_started_at END
     WHERE ${expired} OR ${unchanged} OR ${t}.changes_in_window < $8
     RETURNING ${ENTRY_COLUMNS}`,
    [ownerKey, semesterId, classIds, source, discoverable, cleanRegNo, cleanName, MAX_CHANGES_PER_DAY]
  );
  return rows.length ? toEntry(rows[0]) : null;
}

export async function backfillRegisterNo(
  ownerKey: string,
  semesterId: string,
  regNo: string,
  displayName: string = "",
  handle: string = ""
): Promise<void> {
  const cleanRegNo = regNo.trim().toUpperCase();
  const cleanName = displayName.trim();
  if (!cleanRegNo && !cleanName) return;
  const pool = getDbPool();
  const isProperReg = /^[0-9]{2}[A-Z]{3}[0-9]{4,5}$/i.test(cleanRegNo);

  if (cleanRegNo) {
    await pool.query(
      `DELETE FROM ${FFCS_MATCH_TABLE}
        WHERE semester_id = $1 AND UPPER(register_no) = $2 AND owner_key <> $3`,
      [semesterId, cleanRegNo, ownerKey]
    );

    if (isProperReg && cleanName) {
      await pool.query(
        `DELETE FROM ${FFCS_MATCH_TABLE}
          WHERE semester_id = $1
            AND owner_key <> $2
            AND UPPER(TRIM(display_name)) = UPPER($3)
            AND NOT (register_no ~* '^[0-9]{2}[A-Z]{3}[0-9]{4,5}$')`,
        [semesterId, ownerKey, cleanName]
      );
    }
  }

  // If a row exists for (owner_key, semester_id), replace the registration number with the proper one
  const { rows } = await pool.query(
    `UPDATE ${FFCS_MATCH_TABLE}
        SET register_no = CASE WHEN $1 <> '' THEN $1 ELSE register_no END,
            display_name = CASE WHEN $4 <> '' THEN $4 ELSE display_name END,
            updated_at = NOW()
      WHERE owner_key = $2 AND semester_id = $3
      RETURNING class_ids, discoverable, register_no`,
    [cleanRegNo, ownerKey, semesterId, cleanName]
  );

  if (rows.length && cleanRegNo) {
    const classIds = (rows[0].class_ids as string[]) ?? [];
    const discoverable = Boolean(rows[0].discoverable);
    if (classIds.length > 0) {
      await registerStudentClasses(
        semesterId,
        classIds,
        cleanRegNo,
        cleanName,
        handle,
        ownerKey,
        discoverable
      );
    }
  }
}

const syncedSemesters = new Set<string>();

/**
 * Sync all course offerings from the FFCS report into the master `ffcs_classes` table.
 */
export async function syncClassesFromReport(
  semesterId: string,
  offerings: ReadonlyMap<string, FfcsOffering>
): Promise<void> {
  if (syncedSemesters.has(semesterId) || offerings.size === 0) return;
  const pool = getDbPool();
  const classIds: string[] = [];
  const codes: string[] = [];
  const titles: string[] = [];
  const types: string[] = [];
  const slots: string[] = [];
  const faculties: string[] = [];
  const credits: string[] = [];
  const rooms: string[] = [];

  for (const [classId, o] of offerings.entries()) {
    classIds.push(classId);
    codes.push(o.code || "");
    titles.push(o.title || "");
    types.push(o.type || "");
    slots.push(o.slot || "");
    faculties.push(o.faculty || "");
    credits.push(o.credits || "");
    rooms.push(o.room || "");
  }

  await pool.query(
    `INSERT INTO ${FFCS_CLASSES_TABLE} (
       semester_id, class_id, course_code, course_title, course_type, slot, faculty, credits, room
     )
     SELECT $1, u.class_id, u.code, u.title, u.type, u.slot, u.faculty, u.credits, u.room
       FROM UNNEST(
         $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[]
       ) AS u(class_id, code, title, type, slot, faculty, credits, room)
     ON CONFLICT (semester_id, class_id) DO UPDATE SET
       course_code = EXCLUDED.course_code,
       course_title = EXCLUDED.course_title,
       course_type = EXCLUDED.course_type,
       slot = EXCLUDED.slot,
       faculty = EXCLUDED.faculty,
       credits = EXCLUDED.credits,
       room = EXCLUDED.room,
       updated_at = NOW()`,
    [semesterId, classIds, codes, titles, types, slots, faculties, credits, rooms]
  );

  syncedSemesters.add(semesterId);
}

/**
 * Register a student's register number and details against their classes in `ffcs_classes`
 * and `ffcs_class_registrations`. Ensures (register_no, semester_id) does not duplicate
 * by purging prior registrations for this student in this semester first.
 */
export async function registerStudentClasses(
  semesterId: string,
  classIds: string[],
  registerNo: string,
  displayName: string,
  handle: string,
  ownerKey: string,
  discoverable: boolean = true
): Promise<void> {
  const pool = getDbPool();

  // 1. Ensure rows exist in ffcs_classes for all classIds
  if (classIds.length > 0) {
    await pool.query(
      `INSERT INTO ${FFCS_CLASSES_TABLE} (semester_id, class_id)
       SELECT $1, id FROM UNNEST($2::text[]) AS id
       ON CONFLICT (semester_id, class_id) DO NOTHING`,
      [semesterId, classIds]
    );
  }

  // 2. Remove existing registrations for this student in this semester
  if (registerNo || ownerKey) {
    await pool.query(
      `DELETE FROM ${FFCS_CLASS_REGISTRATIONS_TABLE}
        WHERE semester_id = $1 AND (
          ($2 <> '' AND register_no = $2) OR
          ($3 <> '' AND owner_key = $3)
        )`,
      [semesterId, registerNo, ownerKey]
    );

    if (registerNo) {
      await pool.query(
        `UPDATE ${FFCS_CLASSES_TABLE}
            SET register_nos = array_remove(register_nos, $2),
                updated_at = NOW()
          WHERE semester_id = $1 AND $2 = ANY(register_nos)`,
        [semesterId, registerNo]
      );
    }
  }

  // 3. Insert new registrations
  if (classIds.length > 0 && registerNo) {
    await pool.query(
      `INSERT INTO ${FFCS_CLASS_REGISTRATIONS_TABLE} (
         semester_id, class_id, register_no, display_name, handle, owner_key, discoverable, updated_at
       )
       SELECT $1, id, $2, $3, $4, $5, $6, NOW()
         FROM UNNEST($7::text[]) AS id
       ON CONFLICT (semester_id, class_id, register_no) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         handle = EXCLUDED.handle,
         owner_key = EXCLUDED.owner_key,
         discoverable = EXCLUDED.discoverable,
         updated_at = NOW()`,
      [semesterId, registerNo, displayName, handle, ownerKey, discoverable, classIds]
    );

    await pool.query(
      `UPDATE ${FFCS_CLASSES_TABLE}
          SET register_nos = array_append(array_remove(register_nos, $2), $2),
              updated_at = NOW()
        WHERE semester_id = $1 AND class_id = ANY($3::text[])`,
      [semesterId, registerNo, classIds]
    );
  }
}

/**
 * Remove a student from all classes for a semester.
 */
export async function unregisterStudentClasses(
  semesterId: string,
  registerNo: string,
  ownerKey: string
): Promise<void> {
  const pool = getDbPool();
  if (!registerNo && !ownerKey) return;

  await pool.query(
    `DELETE FROM ${FFCS_CLASS_REGISTRATIONS_TABLE}
      WHERE semester_id = $1 AND (
        ($2 <> '' AND register_no = $2) OR
        ($3 <> '' AND owner_key = $3)
      )`,
    [semesterId, registerNo, ownerKey]
  );

  if (registerNo) {
    await pool.query(
      `UPDATE ${FFCS_CLASSES_TABLE}
          SET register_nos = array_remove(register_nos, $2),
              updated_at = NOW()
        WHERE semester_id = $1 AND $2 = ANY(register_nos)`,
      [semesterId, registerNo]
    );
  }
}

/**
 * Update discoverability for a student's class registrations.
 */
export async function setClassRegistrationsDiscoverable(
  semesterId: string,
  registerNo: string,
  ownerKey: string,
  discoverable: boolean
): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    `UPDATE ${FFCS_CLASS_REGISTRATIONS_TABLE}
        SET discoverable = $4,
            updated_at = NOW()
      WHERE semester_id = $1 AND (
        ($2 <> '' AND register_no = $2) OR
        ($3 <> '' AND owner_key = $3)
      )`,
    [semesterId, registerNo, ownerKey, discoverable]
  );
}

export type ClassRosterStudent = {
  regNo: string;
  name: string;
  handle: string;
};

export type ClassRosterEntry = {
  classId: string;
  courseCode: string;
  courseTitle: string;
  courseType: string;
  slot: string;
  faculty: string;
  credits: string;
  room: string;
  registerNos: string[];
  students: ClassRosterStudent[];
};

/**
 * Query class numbers along with the register numbers and student details in each class.
 */
export async function getClassRosters(
  semesterId: string,
  classIds?: string[]
): Promise<ClassRosterEntry[]> {
  const pool = getDbPool();
  const filterByClasses = Array.isArray(classIds) && classIds.length > 0;

  const query = filterByClasses
    ? `SELECT c.class_id, c.course_code, c.course_title, c.course_type, c.slot, c.faculty, c.credits, c.room, c.register_nos,
              COALESCE(
                json_agg(
                  json_build_object(
                    'regNo', r.register_no,
                    'name', r.display_name,
                    'handle', r.handle
                  ) ORDER BY r.display_name
                ) FILTER (WHERE r.register_no IS NOT NULL AND r.discoverable),
                '[]'::json
              ) AS students
         FROM ${FFCS_CLASSES_TABLE} c
         LEFT JOIN ${FFCS_CLASS_REGISTRATIONS_TABLE} r
           ON r.semester_id = c.semester_id
          AND r.class_id = c.class_id
        WHERE c.semester_id = $1
          AND c.class_id = ANY($2::text[])
        GROUP BY c.class_id, c.course_code, c.course_title, c.course_type, c.slot, c.faculty, c.credits, c.room, c.register_nos
        ORDER BY c.course_code, c.class_id`
    : `SELECT c.class_id, c.course_code, c.course_title, c.course_type, c.slot, c.faculty, c.credits, c.room, c.register_nos,
              COALESCE(
                json_agg(
                  json_build_object(
                    'regNo', r.register_no,
                    'name', r.display_name,
                    'handle', r.handle
                  ) ORDER BY r.display_name
                ) FILTER (WHERE r.register_no IS NOT NULL AND r.discoverable),
                '[]'::json
              ) AS students
         FROM ${FFCS_CLASSES_TABLE} c
         LEFT JOIN ${FFCS_CLASS_REGISTRATIONS_TABLE} r
           ON r.semester_id = c.semester_id
          AND r.class_id = c.class_id
        WHERE c.semester_id = $1
          AND (c.register_nos <> '{}' OR r.register_no IS NOT NULL)
        GROUP BY c.class_id, c.course_code, c.course_title, c.course_type, c.slot, c.faculty, c.credits, c.room, c.register_nos
        ORDER BY c.course_code, c.class_id`;

  const params = filterByClasses ? [semesterId, classIds] : [semesterId];
  const { rows } = await pool.query(query, params);

  return rows.map((r) => ({
    classId: r.class_id as string,
    courseCode: (r.course_code as string) || "",
    courseTitle: (r.course_title as string) || "",
    courseType: (r.course_type as string) || "",
    slot: (r.slot as string) || "",
    faculty: (r.faculty as string) || "",
    credits: (r.credits as string) || "",
    room: (r.room as string) || "",
    registerNos: (r.register_nos as string[]) || [],
    students: (r.students as ClassRosterStudent[]) || [],
  }));
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
    `SELECT p.handle, p.display_name, e.source, e.class_ids, e.updated_at, e.register_no
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
    regNo: (r.register_no as string) || "",
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
