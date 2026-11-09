import { NextResponse } from "next/server";
import { getDbPool } from "./db";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number };

const hits = new Map<string, number[]>();

/**
 * Shared rate limit, backed by Postgres so every instance (and every restart)
 * sees the same counts. The in-memory limiter below was per instance, so on a
 * horizontally scaled or serverless deploy each instance had its own budget.
 *
 * Fixed-window counter: one row per (key, window). The upsert is atomic, so
 * concurrent requests on different instances cannot both slip under the cap.
 *
 * If Postgres is unreachable we fall back to the in-memory limiter rather than
 * failing open, so a database outage still leaves per-instance protection.
 */
export const RATE_LIMIT_TABLE = "rate_limit_hits";

let schemaReady: Promise<void> | null = null;
let lastPrune = 0;

function ensureRateLimitSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await getDbPool().query(`
      CREATE TABLE IF NOT EXISTS ${RATE_LIMIT_TABLE} (
        key          TEXT        NOT NULL,
        window_start BIGINT      NOT NULL,
        hits         INTEGER     NOT NULL DEFAULT 0,
        expires_at   TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (key, window_start)
      )
    `);
    await getDbPool().query(
      `CREATE INDEX IF NOT EXISTS ${RATE_LIMIT_TABLE}_expires_idx ON ${RATE_LIMIT_TABLE} (expires_at)`
    );
  })().catch((err) => {
    schemaReady = null; // retry DDL on the next call
    throw err;
  });
  return schemaReady;
}

/** Window maths, exported for tests. */
export function fixedWindow(now: number, windowMs: number): { start: number; retryAfterMs: number } {
  const start = Math.floor(now / windowMs) * windowMs;
  return { start, retryAfterMs: start + windowMs - now };
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const { start, retryAfterMs } = fixedWindow(now, windowMs);
  try {
    await ensureRateLimitSchema();
    const pool = getDbPool();
    const { rows } = await pool.query<{ hits: number }>(
      `INSERT INTO ${RATE_LIMIT_TABLE} (key, window_start, hits, expires_at)
       VALUES ($1, $2, 1, to_timestamp($3 / 1000.0))
       ON CONFLICT (key, window_start) DO UPDATE SET hits = ${RATE_LIMIT_TABLE}.hits + 1
       RETURNING hits`,
      [key, start, start + windowMs]
    );
    const count = rows[0]?.hits ?? 1;
    if (now - lastPrune > 300_000) {
      lastPrune = now;
      pool.query(`DELETE FROM ${RATE_LIMIT_TABLE} WHERE expires_at < NOW()`).catch(() => {});
    }
    if (count > maxRequests) return { allowed: false, remaining: 0, retryAfterMs };
    return { allowed: true, remaining: maxRequests - count, retryAfterMs };
  } catch (err) {
    console.error("[rateLimit] shared store unavailable, using in-memory limiter:", (err as Error)?.message);
    return checkRateLimitLocal(key, maxRequests, windowMs);
  }
}

/** Per-instance sliding-window limiter. Used directly only as the fallback. */
export function checkRateLimitLocal(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const timestamps = (hits.get(key) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: windowMs - (now - oldest),
    };
  }

  timestamps.push(now);
  hits.set(key, timestamps);

  return {
    allowed: true,
    remaining: maxRequests - timestamps.length,
    retryAfterMs: windowMs,
  };
}

export function rateLimitResponse(retryAfterMs: number): NextResponse {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return NextResponse.json(
    { success: false, error: "Too many requests. Try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": "0",
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits) {
      const valid = timestamps.filter((t) => now - t < 600000);
      if (valid.length === 0) hits.delete(key);
      else hits.set(key, valid);
    }
  }, 300000);
}
