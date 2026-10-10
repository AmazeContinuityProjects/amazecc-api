import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  assessmentKeyFor,
  valueToken,
  ownerKeyFor,
  standardDeviation,
  recordContribution,
  statsForClasses,
  OVERALL_KEY,
} from "./marksStats";

/**
 * Unit tests for the cohort statistics.
 *
 * The first test is the load-bearing one. The client re-derives `assessmentKeyFor`
 * to join a statistic back to the assessment it renders, so if these two
 * implementations ever drift, every read silently misses and the UI falls back to
 * "not enough data" with nothing to indicate why. The expected value below was
 * computed independently on both sides and must never change without changing both.
 */

// ── key derivation ───────────────────────────────────────────────────────────

describe("assessmentKeyFor", () => {
  it("matches the client implementation byte-for-byte", () => {
    expect(
      assessmentKeyFor(
        "CH2026270102001",
        "theory",
        "Continuous Assessment Test - I"
      )
    ).toBe("980839950cdf23ab162c753ae63ad4b8");
  });

  it("is deterministic and 32 hex chars", () => {
    const a = assessmentKeyFor("X", "theory", "CAT I");
    const b = assessmentKeyFor("X", "theory", "CAT I");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });

  it("separates the theory and lab halves of an embedded course", () => {
    expect(assessmentKeyFor("X", "theory", "CAT I")).not.toBe(
      assessmentKeyFor("X", "lab", "CAT I")
    );
  });

  it("normalises whitespace so cosmetic differences cannot fork a key", () => {
    expect(assessmentKeyFor("X", "theory", "CAT   I")).toBe(
      assessmentKeyFor("X", "theory", "CAT I")
    );
  });
});

describe("valueToken", () => {
  it("is deterministic", () => {
    expect(valueToken(80)).toBe(valueToken(80));
  });

  it("collapses cosmetic number formats so a reformat cannot fork a history", () => {
    expect(valueToken(80)).toBe(valueToken(80.0));
  });

  it("differs across values", () => {
    expect(valueToken(80)).not.toBe(valueToken(81));
  });
});

describe("ownerKeyFor", () => {
  it("uppercases and trims, mirroring the social route", () => {
    expect(ownerKeyFor("  21bce1234 ")).toBe(ownerKeyFor("21BCE1234"));
  });
});

describe("standardDeviation", () => {
  it("is zero when there is no spread to report", () => {
    expect(standardDeviation({ count: 0, mean: 0, m2: 0 })).toBe(0);
    expect(standardDeviation({ count: 1, mean: 80, m2: 0 })).toBe(0);
  });

  it("derives the population standard deviation", () => {
    // 70, 80, 90 → mean 80, m2 200, sd sqrt(200/3).
    expect(standardDeviation({ count: 3, mean: 80, m2: 200 })).toBeCloseTo(
      Math.sqrt(200 / 3),
      9
    );
  });

  it("never returns NaN for a negative m2", () => {
    expect(standardDeviation({ count: 7, mean: 79.13, m2: -32.5757 })).toBe(0);
  });
});

// ── the write state machine ──────────────────────────────────────────────────

/** Minimal in-memory stand-in for a pg PoolClient, keyed the way the tables are. */
function fakeClient(legacy: Array<{ class_id: string; user_hash: string }> = []) {
  const tokens = new Map<string, { value_token: string }>();
  const accs = new Map<string, { count: number; mean: number; m2: number }>();

  const tokenKey = (p: unknown[]) => `${p[0]}|${p[1]}|${p[2]}|${p[3]}`;
  const accKey = (p: unknown[]) =>
    p.length === 1 ? `o|${p[0]}` : `a|${p[0]}|${p[1]}`;

  return {
    tokens,
    accs,
    async query(sql: string, params: unknown[] = []) {
      if (sql.includes("FROM class_user_hashes_legacy")) {
        const hit = legacy.some(
          (r) => r.class_id === params[0] && r.user_hash === params[1]
        );
        return { rows: hit ? [{ "1": 1 }] : [] };
      }
      if (sql.includes("FROM class_user_marks")) {
        const hit = tokens.get(tokenKey(params));
        return { rows: hit ? [{ value_token: hit.value_token }] : [] };
      }
      if (sql.startsWith("SELECT count, mean, m2 FROM")) {
        const hit = accs.get(accKey(params));
        return {
          rows: hit
            ? [{ count: hit.count, mean: hit.mean, m2: hit.m2 }]
            : [],
        };
      }
      if (sql.startsWith("INSERT INTO class_overall_stats") || sql.includes("INSERT INTO class_assessment_stats")) {
        const n = params.length;
        accs.set(accKey(params), {
          count: Number(params[n - 3]),
          mean: Number(params[n - 2]),
          m2: Number(params[n - 1]),
        });
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO class_user_marks")) {
        tokens.set(tokenKey(params), { value_token: params[4] as string });
        return { rows: [] };
      }
      throw new Error(`unexpected query in fake: ${sql.slice(0, 80)}`);
    },
  };
}

type Fake = ReturnType<typeof fakeClient>;

const readAcc = (db: Fake) => [...db.accs.values()][0];

describe("recordContribution", () => {
  let db: Fake;
  const now = 1_700_000_000_000;

  beforeEach(() => {
    db = fakeClient();
  });

  it("adds a first contribution", async () => {
    const outcome = await recordContribution(
      db as never,
      "owner-1",
      { classId: "C1", scope: "assessment", component: "theory", title: "CAT I", mark: 80, prevMark: null },
      now
    );
    expect(outcome).toBe("added");
    expect(db.accs.get("a|C1|k") ?? db.accs.values().next().value).toMatchObject({
      count: 1,
      mean: 80,
    });
  });

  it("replaces when the claim matches the stored token", async () => {
    await recordContribution(
      db as never, "owner-1",
      { classId: "C1", scope: "assessment", component: "theory", title: "CAT I", mark: 80, prevMark: null },
      now
    );
    const outcome = await recordContribution(
      db as never, "owner-1",
      { classId: "C1", scope: "assessment", component: "theory", title: "CAT I", mark: 90, prevMark: 80 },
      now + 1
    );
    expect(outcome).toBe("replaced");
    // Only the new value remains: a remove-then-add of the single observation.
    const acc = readAcc(db);
    expect(acc.count).toBe(1);
    expect(acc.mean).toBeCloseTo(90, 9);
  });

  it("is a no-op when the value is unchanged", async () => {
    await recordContribution(
      db as never, "owner-1",
      { classId: "C1", scope: "assessment", component: "theory", title: "CAT I", mark: 80, prevMark: null },
      now
    );
    const outcome = await recordContribution(
      db as never, "owner-1",
      { classId: "C1", scope: "assessment", component: "theory", title: "CAT I", mark: 80, prevMark: 80 },
      now + 1
    );
    expect(outcome).toBe("replaced");
    const acc = readAcc(db);
    expect(acc.count).toBe(1);
    expect(acc.mean).toBeCloseTo(80, 9);
  });

  it("skips when the claim does not match the stored token", async () => {
    await recordContribution(
      db as never, "owner-1",
      { classId: "C1", scope: "assessment", component: "theory", title: "CAT I", mark: 80, prevMark: null },
      now
    );
    const outcome = await recordContribution(
      db as never, "owner-1",
      { classId: "C1", scope: "assessment", component: "theory", title: "CAT I", mark: 40, prevMark: 70 },
      now + 1
    );
    expect(outcome).toBe("skipped");
    const acc = readAcc(db);
    expect(acc.mean).toBeCloseTo(80, 9);
  });

  it("skips when there is a contribution on record but no claim", async () => {
    await recordContribution(
      db as never, "owner-1",
      { classId: "C1", scope: "assessment", component: "theory", title: "CAT I", mark: 80, prevMark: null },
      now
    );
    // Cleared localStorage: the client has no prevMark. Adding on top would double-count.
    const outcome = await recordContribution(
      db as never, "owner-1",
      { classId: "C1", scope: "assessment", component: "theory", title: "CAT I", mark: 90, prevMark: null },
      now + 1
    );
    expect(outcome).toBe("skipped");
    expect([...db.accs.values()][0].count).toBe(1);
  });

  it("rejects out-of-range and unkeyed contributions", async () => {
    expect(
      await recordContribution(
        db as never, "owner-1",
        { classId: "C1", scope: "assessment", component: "theory", title: "CAT I", mark: 101, prevMark: null },
        now
      )
    ).toBe("rejected");
    expect(
      await recordContribution(
        db as never, "owner-1",
        { classId: "", scope: "assessment", component: "theory", title: "CAT I", mark: 80, prevMark: null },
        now
      )
    ).toBe("rejected");
  });

  it("records every assessment in a batch — the old dedupe swallowed all but the first", async () => {
    // First sync for one course: OVERALL plus two assessments, all new.
    const batch = [
      { classId: "C1", scope: "overall" as const, component: "", title: "", mark: 85, prevMark: null },
      { classId: "C1", scope: "assessment" as const, component: "theory", title: "CAT I", mark: 80, prevMark: null },
      { classId: "C1", scope: "assessment" as const, component: "theory", title: "CAT II", mark: 90, prevMark: null },
    ];
    const outcomes = [];
    for (const c of batch) outcomes.push(await recordContribution(db as never, "owner-1", c, now));
    expect(outcomes).toEqual(["added", "added", "added"]);
    expect(db.accs.size).toBe(3);
  });

  it("keeps the overall and the assessments in separate buckets", async () => {
    await recordContribution(
      db as never, "owner-1",
      { classId: "C1", scope: "overall", component: "", title: "", mark: 85, prevMark: null },
      now
    );
    await recordContribution(
      db as never, "owner-1",
      { classId: "C1", scope: "assessment", component: "theory", title: "CAT I", mark: 80, prevMark: null },
      now
    );
    expect(db.accs.size).toBe(2);
    expect(OVERALL_KEY).toBe("overall");
  });

  it("accumulates a cohort mean across students", async () => {
    await recordContribution(
      db as never, "alice",
      { classId: "C1", scope: "assessment", component: "theory", title: "CAT I", mark: 80, prevMark: null },
      now
    );
    await recordContribution(
      db as never, "bob",
      { classId: "C1", scope: "assessment", component: "theory", title: "CAT I", mark: 60, prevMark: null },
      now
    );
    const acc = readAcc(db);
    expect(acc.count).toBe(2);
    expect(acc.mean).toBeCloseTo(70, 9);
  });

  it("never stores a mark, only a token", async () => {
    await recordContribution(
      db as never, "owner-1",
      { classId: "C1", scope: "assessment", component: "theory", title: "CAT I", mark: 80, prevMark: null },
      now
    );
    const stored = [...db.tokens.values()][0].value_token;
    expect(stored).not.toContain("80");
    expect(stored).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ── legacy reconciliation ────────────────────────────────────────────────────

describe("legacy reconciliation", () => {
  // What the old browser client stored: plain SHA-256 of the login ID as typed.
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  const oldHash = (username: string) =>
    createHash("sha256").update(username, "utf8").digest("hex");

  const now = 1_700_000_000_000;
  const CAT = {
    classId: "C1",
    scope: "assessment" as const,
    component: "theory",
    title: "CAT I",
  };

  // Seed the accumulator under the key the implementation actually reads: the
  // hashed (class, component, title), not a placeholder.
  const seedAcc = async (
    db: Fake,
    acc: { count: number; mean: number; m2: number }
  ) => {
    const { assessmentKeyFor: keyFor } = await import("./marksStats");
    const key = keyFor("C1", "theory", "CAT I");
    db.accs.set(`a|C1|${key}`, acc);
  };

  it("replaces instead of double-counting when the login ID matches the register number", async () => {
    // The cohort already holds this student's old 70 under the old scheme.
    const db = fakeClient([{ class_id: "C1", user_hash: oldHash("21BCE1234") }]);
    await seedAcc(db, { count: 3, mean: 70, m2: 200 });

    const outcome = await recordContribution(
      db as never, "owner-new",
      { ...CAT, mark: 90, prevMark: 70 },
      now,
      { authorizedID: "21BCE1234", regNo: "21bce1234" }
    );

    expect(outcome).toBe("reconciled");
    // Old 70 out, new 90 in: count unchanged, mean moved by exactly the delta.
    const acc = readAcc(db);
    expect(acc.count).toBe(3);
    expect(acc.mean).toBeCloseTo(70 + (90 - 70) / 3, 9);
  });

  it("adds normally when the IDs do not match", async () => {
    const db = fakeClient([{ class_id: "C1", user_hash: oldHash("21BCE9999") }]);
    await seedAcc(db, { count: 3, mean: 70, m2: 200 });

    // Different student: their legacy row (if any) is not this one, and the claimed
    // login ID does not match the verified register number, so no reconciliation.
    const outcome = await recordContribution(
      db as never, "owner-new",
      { ...CAT, mark: 90, prevMark: 70 },
      now,
      { authorizedID: "21BCE1234", regNo: "21BCE0000" }
    );

    expect(outcome).toBe("added");
    expect([...db.accs.values()][0].count).toBe(4);
  });

  it("adds normally when there is no legacy record", async () => {
    const db = fakeClient([]);
    const outcome = await recordContribution(
      db as never, "owner-new",
      { ...CAT, mark: 90, prevMark: 70 },
      now,
      { authorizedID: "21BCE1234", regNo: "21BCE1234" }
    );
    expect(outcome).toBe("added");
  });

  it("matches regardless of the casing the old client hashed", async () => {
    // Saved lowercase, verified uppercase — both must resolve to the same student.
    const db = fakeClient([{ class_id: "C1", user_hash: oldHash("21bce1234") }]);
    await seedAcc(db, { count: 2, mean: 70, m2: 0 });

    const outcome = await recordContribution(
      db as never, "owner-new",
      { ...CAT, mark: 90, prevMark: 70 },
      now,
      { authorizedID: "21BCE1234", regNo: "21BCE1234" }
    );

    expect(outcome).toBe("reconciled");
    expect([...db.accs.values()][0].count).toBe(2);
  });

  it("creates a token so the next update takes the exact path", async () => {
    const db = fakeClient([{ class_id: "C1", user_hash: oldHash("21BCE1234") }]);
    await seedAcc(db, { count: 1, mean: 70, m2: 0 });

    await recordContribution(
      db as never, "owner-new",
      { ...CAT, mark: 90, prevMark: 70 },
      now,
      { authorizedID: "21BCE1234", regNo: "21BCE1234" }
    );
    // Second change: token now exists, so this is an exact replace, not another reconcile.
    const second = await recordContribution(
      db as never, "owner-new",
      { ...CAT, mark: 95, prevMark: 90 },
      now + 1,
      { authorizedID: "21BCE1234", regNo: "21BCE1234" }
    );
    expect(second).toBe("replaced");
    const acc = readAcc(db);
    expect(acc.count).toBe(1);
    expect(acc.mean).toBeCloseTo(95, 9);
  });
});

// ── read path ────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => {
  const store = {
    overall: [
      { class_id: "C1", count: 25, mean: 53.36, m2: 4922.4 },
      { class_id: "C2", count: 1, mean: 84, m2: 0 },
    ],
    assessments: [
      { class_id: "C1", assessment_key: "abc123", count: 7, mean: 79.13, m2: -32.5757 },
    ],
  };
  return {
    getDbPool: () => ({
      async query(sql: string, params: unknown[] = []) {
        if (sql.includes("class_overall_stats")) {
          const ids = params[0] as string[];
          return { rows: store.overall.filter((r) => ids.includes(r.class_id)) };
        }
        if (sql.includes("class_assessment_stats")) {
          const ids = params[0] as string[];
          return { rows: store.assessments.filter((r) => ids.includes(r.class_id)) };
        }
        return { rows: [] };
      },
    }),
  };
});

describe("statsForClasses", () => {
  it("returns overall plus per-assessment statistics keyed by class", async () => {
    const stats = await statsForClasses(["C1", "C2", "C9"]);
    expect(stats.C1).toMatchObject({ count: 25, mean: 53.36 });
    expect(stats.C1.sd).toBeCloseTo(14.03, 1);
    expect(stats.C1.assessments.abc123).toMatchObject({ count: 7, mean: 79.13 });
    expect(stats.C2).toMatchObject({ count: 1, sd: 0 });
  });

  it("clamps a negative m2 instead of returning NaN", async () => {
    const stats = await statsForClasses(["C1"]);
    expect(stats.C1.assessments.abc123.sd).toBe(0);
    expect(Number.isNaN(stats.C1.assessments.abc123.sd)).toBe(false);
  });

  it("returns an empty shell for classes with no data", async () => {
    const stats = await statsForClasses(["C9"]);
    expect(stats.C9).toEqual({ count: 0, mean: 0, sd: 0, assessments: {} });
  });

  it("returns nothing for no classes", async () => {
    await expect(statsForClasses([])).resolves.toEqual({});
  });
});
