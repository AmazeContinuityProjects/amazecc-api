/**
 * Integration tests for the friend finder's SQL. Skipped unless
 * FFCS_IT_DATABASE_URL points at a disposable Postgres, e.g.
 *
 *   podman run -d --rm -p 127.0.0.1:55432:5432 -e POSTGRES_PASSWORD=test postgres:17-alpine
 *   FFCS_IT_DATABASE_URL=postgres://postgres:test@localhost:55432/postgres pnpm test
 *
 * It creates and drops its own tables, so never point it at a real database.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.FFCS_IT_DATABASE_URL;

describe.skipIf(!url)("ffcsMatchDb (Postgres)", async () => {
  if (url) process.env.DATABASE_URL = url;
  const { getDbPool } = await import("./db");
  const { ensureSchema, upsertPerson } = await import("./socialDb");
  const db = await import("./ffcsMatchDb");
  const { MAX_CHANGES_PER_DAY } = await import("./ffcsMatch");

  const SEM = "CH20262705";
  const A = "owner-a";
  const B = "owner-b";
  const C = "owner-c";
  const id = (n: number) => `CH20262705${String(n).padStart(5, "0")}`;

  beforeAll(async () => {
    const pool = getDbPool();
    await pool.query(`DROP TABLE IF EXISTS ${db.FFCS_MATCH_TABLE}, social_people, social_timetables`);
    await ensureSchema();
    await db.ensureFfcsMatchSchema();
    await db.ensureFfcsMatchSchema(); // idempotent
    await upsertPerson(A, "ASHA A");
    await upsertPerson(B, "BALA B");
    await upsertPerson(C, "CHITRA C");
  });

  afterAll(async () => {
    const pool = getDbPool();
    await pool.query(`DROP TABLE IF EXISTS ${db.FFCS_MATCH_TABLE}, social_people, social_timetables`);
    await pool.end();
  });

  it("publishes, then finds only discoverable others who overlap", async () => {
    expect(await db.publishEntry(A, SEM, [id(1), id(2)], "planned", true, "22BCE1001")).toMatchObject({
      classIds: [id(1), id(2)],
      changesInWindow: 1,
      registerNo: "22BCE1001",
    });
    await db.publishEntry(B, SEM, [id(2), id(3)], "registered", true, "22BCE1002");
    await db.publishEntry(C, SEM, [id(1)], "planned", false, "22BCE1003");

    const found = await db.findCandidates(A, SEM, [id(1), id(2)]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      name: "BALA B",
      source: "registered",
      classIds: [id(2), id(3)],
      regNo: "22BCE1002",
    });
    expect(found[0].handle).toMatch(/^AMZ-/);
    expect(found[0]).not.toHaveProperty("ownerKey");

    expect(await db.findCandidates(A, "CH20262701", [id(1)])).toEqual([]);
    expect(await db.countParticipants(SEM)).toBe(2);
  });

  it("does not charge a change for re-publishing the same classes", async () => {
    const before = (await db.getEntry(A, SEM))!;
    const again = (await db.publishEntry(A, SEM, [id(1), id(2)], "planned", true, "22BCE1001"))!;
    expect(again.changesInWindow).toBe(before.changesInWindow);
    expect(again.updatedAt).toBe(before.updatedAt);
  });

  it("refuses changes past the daily cap, but still allows an unchanged re-publish", async () => {
    let last = (await db.getEntry(A, SEM))!;
    for (let n = last.changesInWindow; n < MAX_CHANGES_PER_DAY; n++) {
      last = (await db.publishEntry(A, SEM, [id(100 + n)], "planned", true, "22BCE1001"))!;
      expect(last).not.toBeNull();
    }
    expect(last.changesInWindow).toBe(MAX_CHANGES_PER_DAY);
    expect(await db.publishEntry(A, SEM, [id(999)], "planned", true, "22BCE1001")).toBeNull();
    expect((await db.getEntry(A, SEM))!.classIds).toEqual(last.classIds);
    expect(await db.publishEntry(A, SEM, last.classIds, "planned", true, "22BCE1001")).not.toBeNull();
    // Switching source counts as a change too.
    expect(await db.publishEntry(A, SEM, last.classIds, "registered", true, "22BCE1001")).toBeNull();
  });

  it("holds the cap under concurrent publishes", async () => {
    await db.deleteEntry(B, SEM);
    const results = await Promise.all(
      Array.from({ length: MAX_CHANGES_PER_DAY + 5 }, (_, n) =>
        db.publishEntry(B, SEM, [id(500 + n)], "planned", true, "22BCE1002")
      )
    );
    expect(results.filter(Boolean)).toHaveLength(MAX_CHANGES_PER_DAY);
    expect((await db.getEntry(B, SEM))!.changesInWindow).toBe(MAX_CHANGES_PER_DAY);
  });

  it("opens a fresh window after 24 hours", async () => {
    await getDbPool().query(
      `UPDATE ${db.FFCS_MATCH_TABLE} SET window_started_at = NOW() - INTERVAL '25 hours' WHERE owner_key = $1`,
      [A]
    );
    expect(await db.publishEntry(A, SEM, [id(7)], "planned", true, "22BCE1001")).toMatchObject({ changesInWindow: 1 });
  });

  it("hides, unhides and deletes", async () => {
    await db.publishEntry(C, SEM, [id(7)], "planned", true, "22BCE1003");
    expect((await db.findCandidates(A, SEM, [id(7)])).map((c) => c.name)).toEqual(["CHITRA C"]);
    expect(await db.setDiscoverable(C, SEM, false)).toMatchObject({ discoverable: false });
    expect(await db.findCandidates(A, SEM, [id(7)])).toEqual([]);
    expect(await db.setDiscoverable("nobody", SEM, true)).toBeNull();
    expect(await db.deleteEntry(C, SEM)).toBe(true);
    expect(await db.getEntry(C, SEM)).toBeNull();
    expect(await db.deleteEntry(C, SEM)).toBe(false);
  });

  it("backfills register_no without consuming daily changes cap", async () => {
    // Reset entry with blank register_no
    await getDbPool().query(
      `UPDATE ${db.FFCS_MATCH_TABLE} SET register_no = '' WHERE owner_key = $1 AND semester_id = $2`,
      [A, SEM]
    );
    const before = (await db.getEntry(A, SEM))!;
    expect(before.registerNo).toBe("");

    await db.backfillRegisterNo(A, SEM, "22BCE9999");
    const after = (await db.getEntry(A, SEM))!;
    expect(after.registerNo).toBe("22BCE9999");
    expect(after.changesInWindow).toBe(before.changesInWindow);

    // Calling again does not overwrite non-empty register_no
    await db.backfillRegisterNo(A, SEM, "22BCE0000");
    expect((await db.getEntry(A, SEM))!.registerNo).toBe("22BCE9999");
  });

  it("ensures schema cleanup deletes only planned rows", async () => {
    // Directly insert planned and registered rows
    const pool = getDbPool();
    await pool.query(
      `INSERT INTO ${db.FFCS_MATCH_TABLE} (owner_key, semester_id, class_ids, source, discoverable)
       VALUES ('planned-owner', $1, '{}', 'planned', true)
       ON CONFLICT (owner_key, semester_id) DO UPDATE SET source = 'planned'`,
      [SEM]
    );
    await pool.query(
      `INSERT INTO ${db.FFCS_MATCH_TABLE} (owner_key, semester_id, class_ids, source, discoverable)
       VALUES ('reg-owner', $1, '{}', 'registered', true)
       ON CONFLICT (owner_key, semester_id) DO UPDATE SET source = 'registered'`,
      [SEM]
    );

    // Run cleanup query
    await pool.query(`DELETE FROM ${db.FFCS_MATCH_TABLE} WHERE source = 'planned'`);

    expect(await db.getEntry("planned-owner", SEM)).toBeNull();
    expect(await db.getEntry("reg-owner", SEM)).not.toBeNull();
  });
});
