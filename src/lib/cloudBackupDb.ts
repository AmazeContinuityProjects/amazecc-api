import { getDbPool } from "./db";

/**
 * Encrypted backups of a student's local AmazeCC data (tasks, FFCS plans,
 * friends, settings).
 *
 * The browser encrypts the backup with a passphrase that never leaves the
 * device (PBKDF2 -> AES-GCM). This table holds only the ciphertext and the
 * public KDF parameters, keyed by the masked owner key from identifyCaller,
 * so the server cannot read a backup and a request body cannot name someone
 * else's row. Inline DDL, following socialDb.ts (this repo has no migrations).
 */
export const CLOUD_BACKUP_TABLE = "cloud_backups";

/** Largest accepted envelope. A typical backup is a few KB; FFCS-heavy ones ~100 KB. */
export const MAX_BACKUP_BYTES = 512 * 1024;

export interface BackupEnvelope {
  v: number;
  kdf: string;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

let schemaReady: Promise<void> | null = null;

export function ensureCloudBackupSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await getDbPool().query(`
      CREATE TABLE IF NOT EXISTS ${CLOUD_BACKUP_TABLE} (
        owner_key   TEXT PRIMARY KEY,
        envelope    JSONB NOT NULL,
        size_bytes  INTEGER NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Shape check only; the server cannot (and should not) decrypt it. */
export function validateEnvelope(e: unknown): { ok: true; envelope: BackupEnvelope; size: number } | { ok: false; error: string } {
  if (!e || typeof e !== "object") return { ok: false, error: "missing_envelope" };
  const x = e as Record<string, unknown>;
  if (x.v !== 1) return { ok: false, error: "unsupported_version" };
  if (x.kdf !== "PBKDF2-SHA256") return { ok: false, error: "unsupported_kdf" };
  if (typeof x.iterations !== "number" || x.iterations < 100_000 || x.iterations > 10_000_000) {
    return { ok: false, error: "bad_iterations" };
  }
  for (const k of ["salt", "iv", "ciphertext"] as const) {
    if (typeof x[k] !== "string" || !B64.test(x[k] as string)) return { ok: false, error: `bad_${k}` };
  }
  const envelope: BackupEnvelope = {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iterations: x.iterations as number,
    salt: x.salt as string,
    iv: x.iv as string,
    ciphertext: x.ciphertext as string,
  };
  const size = Buffer.byteLength(JSON.stringify(envelope));
  if (size > MAX_BACKUP_BYTES) return { ok: false, error: "too_large" };
  return { ok: true, envelope, size };
}
