import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Hashing for the social sharing grants.
 *
 * `SOCIAL_GRANT_SECRET_KEY` is deliberately a THIRD key, distinct from both
 * `ADMIN_SECRET` (which signs admin and club tokens) and `ID_SALT` (which
 * salts the student-identity pseudonym in `maskUserID`).
 *
 * It must stay distinct. If it shared a value with either of those, an
 * attacker holding one would hold the other, and the two protections would
 * stop being independent — the exact problem that having `ADMIN_SECRET` and
 * `ID_SALT` set to the same value already causes in this repo.
 */

let cached: string | null = null;

/**
 * Read the key, failing loudly.
 *
 * Every other secret in this repo fails lazily — `getDbPool` throws on first
 * query, `getSecret` throws on first call. That is the right default, but a
 * missing grant key would otherwise only surface as an opaque 500 on the first
 * read, so this one is checked at module load.
 */
function requireKey(): string {
  if (cached) return cached;
  const key = process.env.SOCIAL_GRANT_SECRET_KEY;
  if (!key) {
    throw new Error(
      "SOCIAL_GRANT_SECRET_KEY is not set. It must differ from ADMIN_SECRET and " +
        "ID_SALT. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\""
    );
  }
  if (key.length < 32) {
    throw new Error(
      "SOCIAL_GRANT_SECRET_KEY is too short (min 32 chars). Generate one with: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\""
    );
  }
  if (key === process.env.ADMIN_SECRET || key === process.env.ID_SALT) {
    throw new Error(
      "SOCIAL_GRANT_SECRET_KEY must not equal ADMIN_SECRET or ID_SALT. Reusing a " +
        "value across the token-signing key and the identity salt makes both " +
        "compromisable by the same leak."
    );
  }
  cached = key;
  return key;
}

export function assertGrantSecretConfigured(): void {
  requireKey();
}

/** 32 random bytes, base64url. The plaintext goes to both paired users. */
export function generateGrantSecret(): string {
  return randomBytes(32).toString("base64url");
}

/** What actually lands in the database. */
export function hashGrantSecret(secret: string): string {
  return createHmac("sha256", requireKey()).update(secret).digest("hex");
}

/** Constant-time compare, matching the style of `auth.ts:67-69`. */
export function grantSecretMatches(presented: string, storedHash: string): boolean {
  const expected = Buffer.from(hashGrantSecret(presented), "utf8");
  const actual = Buffer.from(storedHash, "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

// ── at-rest encryption ────────────────────────────────────────────────
//
// A hash alone is not enough, and an earlier draft of the design got this
// wrong. It specified storing only `secret_hash`, then also expected the
// server to hand the plaintext back to the *other* partner on their next sync.
// That is impossible: a hash cannot be reversed, so the non-claiming partner
// could never obtain the shared secret and would be permanently unable to read
// the timetables they were just granted.
//
// Both sides hold the secret, so it has to be recoverable by the server for the
// second participant. It is therefore stored ENCRYPTED as well as hashed:
//
//   secret_hash  indexed, used to find the grant when a secret is presented
//   secret_enc   AES-256-GCM, decrypted only for an authenticated participant
//
// The threat model is unchanged in the way that matters. A non-participant can
// never obtain the secret, because every read path checks the derived identity
// against the grant's participants first. What this does cost is that a
// database dump is no longer sufficient on its own — an attacker would also need
// the application key. Given the server already stores every timetable in
// plaintext, that is a marginal difference, and it is the right trade for
// mutual pairing working at all.

const ENCRYPTION_CONTEXT = "social-grant-secret/aes-256-gcm/v1";

function encryptionKey(): Buffer {
  // Domain-separated from the hashing key so the two uses cannot interact.
  return createHmac("sha256", requireKey()).update(ENCRYPTION_CONTEXT).digest();
}

/** `iv:tag:ciphertext`, all base64url. */
export function encryptGrantSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ct].map((b) => b.toString("base64url")).join(":");
}

export function decryptGrantSecret(payload: string): string | null {
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  try {
    const [iv, tag, ct] = parts.map((p) => Buffer.from(p ?? "", "base64url"));
    if (!iv || !tag || !ct) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key or tampered payload. Treat as unreadable rather than throwing,
    // so a single bad row cannot break the whole sync.
    return null;
  }
}
