import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-process stand-in for the Postgres upsert: counts per (key, window).
const counts = new Map<string, number>();
let failQueries = false;
const query = vi.fn(async (sql: string, params?: unknown[]) => {
  if (failQueries) throw new Error("connection refused");
  if (sql.includes("INSERT INTO")) {
    const id = `${params?.[0]}|${params?.[1]}`;
    const next = (counts.get(id) ?? 0) + 1;
    counts.set(id, next);
    return { rows: [{ hits: next }] };
  }
  return { rows: [] };
});

vi.mock("./db", () => ({ getDbPool: () => ({ query }) }));

const { checkRateLimit, fixedWindow } = await import("./rateLimit");

describe("fixedWindow", () => {
  it("aligns the window start and reports time to the next window", () => {
    expect(fixedWindow(125_000, 60_000)).toEqual({ start: 120_000, retryAfterMs: 55_000 });
    expect(fixedWindow(120_000, 60_000)).toEqual({ start: 120_000, retryAfterMs: 60_000 });
  });
});

describe("checkRateLimit (shared store)", () => {
  beforeEach(() => {
    counts.clear();
    failQueries = false;
    query.mockClear();
  });

  it("allows up to the cap and blocks the request after it", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await checkRateLimit("login:1.2.3.4", 3, 60_000));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[0].remaining).toBe(2);
    expect(results[3].remaining).toBe(0);
    expect(results[3].retryAfterMs).toBeGreaterThan(0);
  });

  it("keeps separate budgets per key", async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit("a", 3, 60_000);
    expect((await checkRateLimit("a", 3, 60_000)).allowed).toBe(false);
    expect((await checkRateLimit("b", 3, 60_000)).allowed).toBe(true);
  });

  it("falls back to the in-memory limiter when Postgres is down", async () => {
    failQueries = true;
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const r1 = await checkRateLimit("fallback-key", 1, 60_000);
    const r2 = await checkRateLimit("fallback-key", 1, 60_000);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(false);
    errors.mockRestore();
  });
});
