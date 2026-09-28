import { getDbPool } from "./db";
import {
  decryptGrantSecret,
  encryptGrantSecret,
  generateGrantSecret,
  grantSecretMatches,
  hashGrantSecret,
} from "./socialGrantSecret";
import {
  effectiveVisibility,
  isActive,
  isParticipant,
  otherParticipant,
  sortPair,
} from "./socialGrantLogic";
import type { SocialVisibility } from "./socialTypes";

export { effectiveVisibility, isActive, isParticipant, otherParticipant, sortPair };

/**
 * The shared signed key that lets two people read each other's timetable.
 *
 * Pairing is MUTUAL and stored as ONE row, enforced structurally by sorting the
 * participants into `owner_a`/`owner_b` and putting a UNIQUE constraint on the
 * pair. That buys three properties for free:
 *
 *   - exactly one grant can ever exist between two people, even under a race
 *   - there is no follower/following column, so a one-way relationship cannot
 *     accidentally be expressed
 *   - revoking one row severs both directions at once
 */

export const GRANT_TABLE = "social_grants";

export type GrantRow = {
  grantId: string;
  secretHash: string;
  secretEnc: string;
  ownerA: string;
  ownerB: string;
  createdBy: string;
  visibility: SocialVisibility;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

/**
 * Memoised so a read does not re-run DDL on every request. The promise is
 * cached rather than a boolean, so concurrent first-hits share one run instead
 * of racing to CREATE TABLE.
 */
let schemaReady: Promise<void> | null = null;

export async function ensureGrantsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const pool = getDbPool();
      await pool.query(`
    CREATE TABLE IF NOT EXISTS ${GRANT_TABLE} (
      grant_id    TEXT PRIMARY KEY,
      secret_hash TEXT NOT NULL,
      secret_enc  TEXT NOT NULL,
      owner_a     TEXT NOT NULL,
      owner_b     TEXT NOT NULL,
      created_by  TEXT NOT NULL,
      visibility  TEXT NOT NULL DEFAULT 'coarse' CHECK (visibility IN ('coarse', 'full')),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at  TIMESTAMPTZ,
      revoked_at  TIMESTAMPTZ,
      UNIQUE (owner_a, owner_b)
    )
  `);
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_social_grants_hash ON ${GRANT_TABLE} (secret_hash)`
      );
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_social_grants_a ON ${GRANT_TABLE} (owner_a)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_social_grants_b ON ${GRANT_TABLE} (owner_b)`);
    })();
  }
  // Clear the cache if it failed, so a later request can retry the DDL.
  return schemaReady.catch((err) => {
    schemaReady = null;
    throw err;
  });
}

/** Sorted so the pair is order-independent and the UNIQUE constraint bites. */
function assertNotSelf(ownerA: string, ownerB: string) {
  if (ownerA === ownerB) throw new Error("cannot pair with yourself");
}

const SELECT = `
  SELECT grant_id, secret_hash, secret_enc, owner_a, owner_b, created_by,
         visibility, created_at, expires_at, revoked_at
    FROM ${GRANT_TABLE}`;

function toRow(r: Record<string, unknown>): GrantRow {
  return {
    grantId: r.grant_id as string,
    secretHash: r.secret_hash as string,
    secretEnc: r.secret_enc as string,
    ownerA: r.owner_a as string,
    ownerB: r.owner_b as string,
    createdBy: r.created_by as string,
    visibility: (r.visibility as SocialVisibility) ?? "coarse",
    createdAt: new Date(r.created_at as string).toISOString(),
    expiresAt: r.expires_at ? new Date(r.expires_at as string).toISOString() : null,
    revokedAt: r.revoked_at ? new Date(r.revoked_at as string).toISOString() : null,
  };
}

export function isActiveGrant(grant: GrantRow, now = Date.now()): boolean {
  return isActive(grant, now);
}

export type CreateGrantResult = {
  grantId: string;
  secret: string;
  visibility: SocialVisibility;
  createdAt: string;
  created: boolean;
};

/**
 * Create the grant for a pair, or return the existing one untouched.
 *
 * Idempotent by design: re-claiming an existing pair returns the SAME
 * `grantId` and does NOT rotate the secret, because the peer may already have
 * stored it. Rotating would silently break the other party.
 */
export async function createOrGetGrant(
  ownerKey: string,
  peerKey: string,
  options?: { visibility?: SocialVisibility; expiresInMinutes?: number }
): Promise<CreateGrantResult> {
  const pool = getDbPool();
  await ensureGrantsSchema();

  const { ownerA, ownerB } = sortPair(ownerKey, peerKey);
  assertNotSelf(ownerA, ownerB);

  const existing = await getGrantForPair(ownerA, ownerB);
  if (existing) {
    // Only an ACTIVE grant may be handed back. Handing a revoked or expired one
    // out would return a dead secret and leave the user believing they are
    // re-paired when they are not — and because there is one row per pair, that
    // state has to be repaired rather than inserted around.
    const secret = isActive(existing) ? decryptGrantSecret(existing.secretEnc) : null;
    if (secret) {
      return {
        grantId: existing.grantId,
        secret,
        visibility: existing.visibility,
        createdAt: existing.createdAt,
        created: false,
      };
    }
  }

  const secret = generateGrantSecret();
  const grantId = `gr_${generateGrantSecret().slice(0, 22)}`;

  // Re-pairing after a revoke REACTIVATES the single row for the pair rather
  // than adding a second one. That keeps the UNIQUE(owner_a, owner_b)
  // invariant honest ("at most one grant per pair, ever") and guarantees the old
  // secret is dead, because its hash is being overwritten here.
  const { rows } = await pool.query(
    `INSERT INTO ${GRANT_TABLE}
       (grant_id, secret_hash, secret_enc, owner_a, owner_b, created_by, visibility, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (owner_a, owner_b) DO UPDATE
        SET grant_id    = EXCLUDED.grant_id,
            secret_hash = EXCLUDED.secret_hash,
            secret_enc  = EXCLUDED.secret_enc,
            created_by  = EXCLUDED.created_by,
            visibility  = EXCLUDED.visibility,
            created_at  = NOW(),
            expires_at  = EXCLUDED.expires_at,
            revoked_at  = NULL
     RETURNING grant_id, secret_enc, visibility, created_at`,
    [
      grantId,
      hashGrantSecret(secret),
      encryptGrantSecret(secret),
      ownerA,
      ownerB,
      ownerKey,
      options?.visibility ?? "coarse",
      options?.expiresInMinutes ? new Date(Date.now() + options.expiresInMinutes * 60_000) : null,
    ]
  );

  if (!rows.length) throw new Error("could not create or resolve a grant for this pair");

  const row = rows[0];
  // Read the secret back out of the row we just wrote rather than trusting the
  // local variable. If a concurrent claim won the race, its DO UPDATE landed
  // last and the stored secret is the canonical one; returning that keeps both
  // sides converging on a single credential.
  return {
    grantId: row.grant_id as string,
    secret: decryptGrantSecret(row.secret_enc as string) ?? secret,
    visibility: (row.visibility as SocialVisibility) ?? "coarse",
    createdAt: new Date(row.created_at as string).toISOString(),
    // Our grant_id survived only if this statement inserted rather than updated.
    created: row.grant_id === grantId,
  };
}

export async function getGrantForPair(
  ownerA: string,
  ownerB: string
): Promise<GrantRow | null> {
  await ensureGrantsSchema();
  const pool = getDbPool();
  const { rows } = await pool.query(
    `${SELECT} WHERE owner_a = $1 AND owner_b = $2`,
    [ownerA, ownerB]
  );
  return rows.length ? toRow(rows[0]) : null;
}

export async function getGrantById(grantId: string): Promise<GrantRow | null> {
  await ensureGrantsSchema();
  const pool = getDbPool();
  const { rows } = await pool.query(`${SELECT} WHERE grant_id = $1`, [grantId]);
  return rows.length ? toRow(rows[0]) : null;
}

/** Every grant the person is a participant of, newest first. */
export async function listGrantsFor(ownerKey: string): Promise<GrantRow[]> {
  await ensureGrantsSchema();
  const pool = getDbPool();
  const { rows } = await pool.query(
    `${SELECT} WHERE owner_a = $1 OR owner_b = $1 ORDER BY created_at DESC`,
    [ownerKey]
  );
  return rows.map(toRow);
}

/** Resolve a presented secret to its grant. Active grants only. */
export async function findGrantBySecret(
  secret: string
): Promise<GrantRow | null> {
  await ensureGrantsSchema();
  const pool = getDbPool();
  const { rows } = await pool.query(`${SELECT} WHERE secret_hash = $1`, [
    hashGrantSecret(secret),
  ]);
  const grant = rows.length ? toRow(rows[0]) : null;
  if (!grant) return null;
  if (!isActive(grant)) return null;
  // Defence in depth: the indexed lookup already implies a match, but verify
  // rather than trust the index.
  if (!grantSecretMatches(secret, grant.secretHash)) return null;
  return grant;
}

/**
 * The plaintext secret for a participant, so their client can store it.
 * Returns null for a non-participant — the single place that hands out secrets.
 */
export async function secretForParticipant(
  grant: GrantRow,
  ownerKey: string
): Promise<string | null> {
  if (!isParticipant(grant, ownerKey)) return null;
  return decryptGrantSecret(grant.secretEnc);
}

export async function setVisibility(
  grantId: string,
  visibility: SocialVisibility
): Promise<boolean> {
  const pool = getDbPool();
  const { rows } = await pool.query(
    `UPDATE ${GRANT_TABLE} SET visibility = $1 WHERE grant_id = $2 RETURNING grant_id`,
    [visibility, grantId]
  );
  return rows.length > 0;
}

/**
 * Revoke. Idempotent — revoking an already-revoked grant succeeds.
 * One row, so both directions die together.
 */
export async function revokeGrant(grantId: string): Promise<boolean> {
  const pool = getDbPool();
  const { rows } = await pool.query(
    `UPDATE ${GRANT_TABLE}
        SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE grant_id = $1
      RETURNING grant_id`,
    [grantId]
  );
  return rows.length > 0;
}

/** Look up a person by their public handle. */
export async function findOwnerKeyByHandle(
  handle: string
): Promise<{ ownerKey: string; displayName: string | null } | null> {
  const pool = getDbPool();
  const { rows } = await pool.query(
    "SELECT owner_key, display_name FROM social_people WHERE handle = $1",
    [handle]
  );
  if (!rows.length) return null;
  return { ownerKey: rows[0].owner_key as string, displayName: rows[0].display_name ?? null };
}
