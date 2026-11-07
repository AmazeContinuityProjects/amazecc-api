import { getDbPool } from "./db";
import type { Application, ApplicationStatus } from "./recruitment";

/**
 * Storage for recruitment applications.
 *
 * One row per (cycle, email). Submitting again with the same email updates
 * the row while it is still "new", so an applicant can fix a typo without
 * creating duplicates; once reviewed, it is frozen. The submitter's IP is
 * stored only as a keyed hash (`maskIP`), for the per-IP daily cap.
 *
 * Inline DDL, created on first use (repo convention).
 */

export const RECRUITMENT_TABLE = "recruitment_applications";

/**
 * Applications one IP may create or edit per 24 hours. Deliberately generous:
 * a campus network puts hundreds of students behind one public IP, so this
 * only stops a script, not a hostel.
 */
export const MAX_SUBMISSIONS_PER_IP_PER_DAY = 200;
/** Edits one application may receive while unreviewed. */
export const MAX_EDITS = 5;

let schemaReady: Promise<void> | null = null;

export function ensureRecruitmentSchema(): Promise<void> {
  schemaReady ??= (async () => {
    const pool = getDbPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${RECRUITMENT_TABLE} (
        id              BIGSERIAL PRIMARY KEY,
        cycle           TEXT NOT NULL,
        name            TEXT NOT NULL,
        email           TEXT NOT NULL,
        reg_no          TEXT NOT NULL,
        year            SMALLINT NOT NULL,
        roles           TEXT[] NOT NULL,
        other_role      TEXT,
        why             TEXT NOT NULL,
        experience      TEXT,
        links           TEXT[] NOT NULL DEFAULT '{}',
        hours_per_week  SMALLINT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new', 'shortlisted', 'accepted', 'rejected')),
        review_note     TEXT,
        reviewed_by     TEXT,
        edit_count      INTEGER NOT NULL DEFAULT 0,
        ip_hash         TEXT NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (cycle, email)
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS ${RECRUITMENT_TABLE}_ip_recent ON ${RECRUITMENT_TABLE} (ip_hash, updated_at)`
    );
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

export type SubmitOutcome =
  | { kind: "created" | "updated"; id: number }
  | { kind: "locked" }
  | { kind: "too_many_edits" }
  | { kind: "ip_limit" };

/** Recent submissions from this IP hash, for the daily cap. */
async function recentFromIp(ipHash: string): Promise<number> {
  const { rows } = await getDbPool().query(
    `SELECT COUNT(*)::int AS n FROM ${RECRUITMENT_TABLE}
      WHERE ip_hash = $1 AND updated_at > NOW() - INTERVAL '24 hours'`,
    [ipHash]
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Create the application, or update it while it is unreviewed.
 *
 * The update branch's WHERE refuses reviewed rows and rows past the edit cap
 * inside the one statement, so concurrent submissions cannot slip past it.
 */
export async function submitApplication(
  cycle: string,
  app: Application,
  ipHash: string
): Promise<SubmitOutcome> {
  if ((await recentFromIp(ipHash)) >= MAX_SUBMISSIONS_PER_IP_PER_DAY) return { kind: "ip_limit" };

  const t = RECRUITMENT_TABLE;
  const { rows } = await getDbPool().query(
    `INSERT INTO ${t}
       (cycle, name, email, reg_no, year, roles, other_role, why, experience, links, hours_per_week, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10::text[], $11, $12)
     ON CONFLICT (cycle, email) DO UPDATE SET
       name = EXCLUDED.name,
       reg_no = EXCLUDED.reg_no,
       year = EXCLUDED.year,
       roles = EXCLUDED.roles,
       other_role = EXCLUDED.other_role,
       why = EXCLUDED.why,
       experience = EXCLUDED.experience,
       links = EXCLUDED.links,
       hours_per_week = EXCLUDED.hours_per_week,
       ip_hash = EXCLUDED.ip_hash,
       edit_count = ${t}.edit_count + 1,
       updated_at = NOW()
     WHERE ${t}.status = 'new' AND ${t}.edit_count < $13
     RETURNING id, (xmax = 0) AS inserted`,
    [
      cycle,
      app.name,
      app.email,
      app.regNo,
      app.year,
      app.roles,
      app.otherRole,
      app.why,
      app.experience,
      app.links,
      app.hoursPerWeek,
      ipHash,
      MAX_EDITS,
    ]
  );
  if (rows.length) {
    return { kind: rows[0].inserted ? "created" : "updated", id: Number(rows[0].id) };
  }

  // The conflict branch refused the update: find out why, to tell the applicant.
  const { rows: existing } = await getDbPool().query(
    `SELECT status, edit_count FROM ${t} WHERE cycle = $1 AND email = $2`,
    [cycle, app.email]
  );
  return existing[0]?.status !== "new" ? { kind: "locked" } : { kind: "too_many_edits" };
}

export type StoredApplication = Application & {
  id: number;
  cycle: string;
  status: ApplicationStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  editCount: number;
  createdAt: string;
  updatedAt: string;
};

function toApplication(r: Record<string, unknown>): StoredApplication {
  return {
    id: Number(r.id),
    cycle: r.cycle as string,
    name: r.name as string,
    email: r.email as string,
    regNo: r.reg_no as string,
    year: Number(r.year),
    roles: r.roles as string[],
    otherRole: (r.other_role as string) ?? null,
    why: r.why as string,
    experience: (r.experience as string) ?? null,
    links: r.links as string[],
    hoursPerWeek: Number(r.hours_per_week),
    status: r.status as ApplicationStatus,
    reviewNote: (r.review_note as string) ?? null,
    reviewedBy: (r.reviewed_by as string) ?? null,
    editCount: Number(r.edit_count),
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

/** For reviewers. The IP hash never leaves the database. */
export async function listApplications(filter: {
  cycle: string;
  role?: string;
  status?: ApplicationStatus;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; applications: StoredApplication[] }> {
  const where = ["cycle = $1"];
  const params: unknown[] = [filter.cycle];
  if (filter.role) {
    params.push(filter.role);
    where.push(`$${params.length} = ANY(roles)`);
  }
  if (filter.status) {
    params.push(filter.status);
    where.push(`status = $${params.length}`);
  }
  const whereSql = where.join(" AND ");
  const pool = getDbPool();
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM ${RECRUITMENT_TABLE} WHERE ${whereSql}`,
    params
  );
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);
  const { rows } = await pool.query(
    `SELECT id, cycle, name, email, reg_no, year, roles, other_role, why, experience, links,
            hours_per_week, status, review_note, reviewed_by, edit_count, created_at, updated_at
       FROM ${RECRUITMENT_TABLE} WHERE ${whereSql}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  return { total: Number(countRows[0]?.n ?? 0), applications: rows.map(toApplication) };
}

export async function setApplicationStatus(
  id: number,
  status: ApplicationStatus,
  reviewer: string,
  note: string | null
): Promise<StoredApplication | null> {
  const { rows } = await getDbPool().query(
    `UPDATE ${RECRUITMENT_TABLE}
        SET status = $2, reviewed_by = $3, review_note = COALESCE($4, review_note), updated_at = NOW()
      WHERE id = $1
      RETURNING id, cycle, name, email, reg_no, year, roles, other_role, why, experience, links,
                hours_per_week, status, review_note, reviewed_by, edit_count, created_at, updated_at`,
    [id, status, reviewer, note]
  );
  return rows.length ? toApplication(rows[0]) : null;
}
