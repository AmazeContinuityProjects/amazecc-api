import { getDbPool, isCircuitBreakerError } from "@/lib/db";

export const GOROBO_ITEMS_DDL = `
CREATE TABLE IF NOT EXISTS gorobo_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10, 2) NOT NULL,
  category TEXT NOT NULL,
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  image TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export const GOROBO_ITEMS_ALTERS = `
ALTER TABLE gorobo_items ADD COLUMN IF NOT EXISTS base_price NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE gorobo_items ADD COLUMN IF NOT EXISTS margin NUMERIC(10, 2) NOT NULL DEFAULT 0;
`;

export const GOROBO_ORDERS_DDL = `
CREATE TABLE IF NOT EXISTS gorobo_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  items JSONB NOT NULL,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export const GOROBO_ORDERS_ALTERS = `
ALTER TABLE gorobo_orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE gorobo_orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE gorobo_orders ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE gorobo_orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE gorobo_orders ADD COLUMN IF NOT EXISTS gst_pct NUMERIC(5, 2) NOT NULL DEFAULT 18;
ALTER TABLE gorobo_orders ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE gorobo_orders ADD COLUMN IF NOT EXISTS shipment_cost NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE gorobo_orders ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
ALTER TABLE gorobo_orders ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE gorobo_orders ADD COLUMN IF NOT EXISTS maps_url TEXT NOT NULL DEFAULT '';
`;

export const GOROBO_WALLET_ENTRIES_DDL = `
CREATE TABLE IF NOT EXISTS gorobo_wallet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES gorobo_orders(id) ON DELETE CASCADE,
  party TEXT NOT NULL CHECK (party IN ('customer', 'vendor')),
  kind TEXT NOT NULL CHECK (kind IN ('profit', 'gst', 'cost')),
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export const GOROBO_ORDER_STATUSES = ["pending", "confirmed", "completed"] as const;
export type GoroboOrderStatus = (typeof GOROBO_ORDER_STATUSES)[number];

let ensured = false;
let ensuring: Promise<void> | null = null;
let lastFailureAt = 0;
const COOLDOWN_MS = 30_000;

/**
 * Idempotently creates (and upgrades) the GoRobo tables if they do not exist yet.
 * Safe to call from any handler before use.
 * Includes cooldown / circuit-breaker handling so repeated failures (ECIRCUITBREAKER / auth block)
 * do not hammer PgBouncer/Neon and prolong the block. Concurrent callers share the same promise.
 */
export async function ensureGoroboSchema(): Promise<void> {
  if (ensured) return;
  if (ensuring) return ensuring;

  // If we failed very recently and the error was a circuit-breaker / auth block, fail fast without hitting DB again
  if (lastFailureAt && Date.now() - lastFailureAt < COOLDOWN_MS) {
    // Check if last failure was circuit breaker – we store timestamp only for any failure, but we still apply cooldown
    // to avoid tight loop. Callers will receive 503 via getDbError* helpers.
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastFailureAt)) / 1000);
    throw new Error(
      `Database temporarily unavailable (recent failure, retry in ~${remaining}s). If this is ECIRCUITBREAKER / too many authentication failures, verify DATABASE_URL credentials and wait 60s.`
    );
  }

  ensuring = (async () => {
    const pool = getDbPool();
    await pool.query(GOROBO_ITEMS_DDL);
    await pool.query(GOROBO_ITEMS_ALTERS);
    await pool.query(GOROBO_ORDERS_DDL);
    await pool.query(GOROBO_ORDERS_ALTERS);
    await pool.query(GOROBO_WALLET_ENTRIES_DDL);
  })();

  try {
    await ensuring;
    ensured = true;
    lastFailureAt = 0;
  } catch (error: any) {
    lastFailureAt = Date.now();
    // If it's a circuit breaker / auth failure, surface a clearer log and keep cooldown
    if (isCircuitBreakerError(error)) {
      console.error('[gorobo/schema] ensureGoroboSchema blocked by circuit breaker:', error.message);
    } else {
      console.error('[gorobo/schema] ensureGoroboSchema failed:', error?.message || error);
    }
    throw error;
  } finally {
    ensuring = null;
  }
}

export interface GoroboItem {
  id: string;
  name: string;
  description: string;
  price: number;
  base_price: number;
  margin: number;
  category: string;
  in_stock: boolean;
  image: string;
  updated_at?: string;
}

/**
 * A single line on an order. Inventory lines use `itemId` + snapshots;
 * custom lines (not in inventory) use `custom: true` + `name`.
 */
export interface GoroboOrderLine {
  itemId?: string;
  name?: string;
  custom?: boolean;
  quantity: number;
  unitPrice: number;
  basePrice?: number;
  margin?: number;
}

export interface GoroboOrderItem {
  itemId: string;
  quantity: number;
}

export interface GoroboWalletEntry {
  id: string;
  order_id: string;
  party: "customer" | "vendor";
  kind: "profit" | "gst" | "cost";
  amount: number;
  status: "pending" | "settled";
  settled_at: string | null;
  created_at: string;
}
