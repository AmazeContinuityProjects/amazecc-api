import { Pool } from 'pg';

let pool: Pool | undefined;
let poolCreationWarned = false;

function getConnectionString(): string | undefined {
  // Vercel Postgres / Supabase often expose several env names; prefer DATABASE_URL but fallback to common alternatives
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

/**
 * TLS for Postgres. Set PG_CA_CERT to the provider's CA (PEM; for Supabase,
 * download it from Project Settings -> Database -> SSL) to verify the server
 * certificate. Without it we fall back to encrypted-but-unverified, which is
 * open to a man-in-the-middle on the network path.
 */
function pgSslOptions(): { ca?: string; rejectUnauthorized: boolean } {
  const ca = process.env.PG_CA_CERT?.replace(/\\n/g, '\n');
  if (ca) return { ca, rejectUnauthorized: true };
  console.warn('[db] PG_CA_CERT not set: Postgres TLS certificate is NOT verified');
  return { rejectUnauthorized: false };
}

function createPool(): Pool {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Configure DATABASE_URL (or POSTGRES_URL) in Vercel environment variables.'
    );
  }
  const p = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : pgSslOptions(),
    // Serverless-friendly tuning: keep pool small to avoid exhausting PgBouncer / Neon limits
    max: parseInt(process.env.PG_POOL_MAX || '5', 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  p.on('error', (err: unknown) => {
    // Background pool errors (e.g., terminated connections) – log but do not crash process
    // ECIRCUITBREAKER / "too many authentication failures" indicates PgBouncer/Neon has temporarily blocked the tenant
    // due to repeated failed auth attempts (usually wrong password or rotated DATABASE_URL)
    const msg = err instanceof Error ? err.message : String(err ?? '');
    if (
      msg.includes('ECIRCUITBREAKER') ||
      msg.includes('too many authentication failures') ||
      msg.includes('too many connections')
    ) {
      console.error(
        '[db] Circuit breaker / auth block from Postgres (check DATABASE_URL credentials and wait ~60s):',
        msg
      );
    } else {
      console.error('[db] Unexpected pool error:', msg);
    }
  });

  p.on('connect', () => {
    if (!poolCreationWarned) {
      // One-time log to confirm pool creation without leaking secrets
      const sanitized = connectionString.replace(/:\/\/[^@]+@/, '://***:***@');
      console.log(`[db] Pool created -> ${sanitized.split('?')[0]}`);
      poolCreationWarned = true;
    }
  });

  return p;
}

export function getDbPool(): Pool {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

// Helper for route handlers to map low-level pg errors to user-facing HTTP status
export function isCircuitBreakerError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return (
    msg.includes('ECIRCUITBREAKER') ||
    msg.includes('too many authentication failures') ||
    msg.includes('too many connections')
  );
}

export function getDbErrorStatus(error: unknown): number {
  return isCircuitBreakerError(error) ? 503 : 500;
}

export function getDbErrorMessage(error: unknown): string {
  // Client-facing: never echo the driver's message (table names, SQL, hosts).
  // The full error is logged here for operators.
  if (isCircuitBreakerError(error)) {
    console.error('[db] circuit breaker: verify DATABASE_URL credentials and wait ~60s', error);
    return 'Database temporarily unavailable. Please try again in a minute.';
  }
  console.error('[db] error hidden from client:', error);
  return 'Internal database error';
}

// For testing / graceful shutdown: allow resetting pool (e.g., after credentials rotate)
export function resetDbPool(): void {
  if (pool) {
    pool.end().catch(() => {});
    pool = undefined;
    poolCreationWarned = false;
  }
}
