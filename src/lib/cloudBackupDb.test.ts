import { describe, expect, it } from "vitest";
import { MAX_BACKUP_BYTES, validateEnvelope } from "./cloudBackupDb";

const good = { v: 1, kdf: "PBKDF2-SHA256", iterations: 600_000, salt: "c2FsdA==", iv: "aXY=", ciphertext: "Y2lwaGVy" };

describe("validateEnvelope", () => {
  it("accepts a well-formed envelope and reports its size", () => {
    const r = validateEnvelope(good);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.size).toBeGreaterThan(0);
  });

  it.each([
    [{ ...good, v: 2 }, "unsupported_version"],
    [{ ...good, kdf: "none" }, "unsupported_kdf"],
    [{ ...good, iterations: 10 }, "bad_iterations"],
    [{ ...good, salt: "not base64!" }, "bad_salt"],
    [{ ...good, ciphertext: 42 }, "bad_ciphertext"],
    [null, "missing_envelope"],
  ])("rejects %j", (env, error) => {
    expect(validateEnvelope(env)).toEqual({ ok: false, error });
  });

  it("rejects envelopes over the size cap", () => {
    const big = { ...good, ciphertext: "A".repeat(MAX_BACKUP_BYTES) };
    expect(validateEnvelope(big)).toEqual({ ok: false, error: "too_large" });
  });

  it("drops unknown fields so nothing else is stored", () => {
    const r = validateEnvelope({ ...good, plaintext: "secret" });
    expect(r.ok && JSON.stringify(r.envelope)).not.toContain("secret");
  });
});
