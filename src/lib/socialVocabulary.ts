import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * The slot vocabulary, and the only place on the server that reads
 * `config.json`.
 *
 * ## Why this file is load-bearing
 *
 * `slotMap` defines 164 weekly slots, and 24 of the ids exist on more than one
 * day at different times (`A1` is 8:00-8:50 on MON and 8:55-9:45 on WED). A
 * bare slot id is therefore ambiguous, and `(day, slotId)` is the only correct
 * storage key.
 *
 * The server validates every published key against THIS copy, so a stale or
 * divergent copy does not corrupt records — it fails them loudly instead.
 *
 * ## Drift warning
 *
 * This file is a copy of the frontend's `config.json`, and the two have
 * already drifted once: the server's copy was missing `S8B` and `S10B` and had
 * `S8`/`S10` an hour off. Nothing detected it, because the server copy had
 * zero importers until this module existed. Any change to the frontend
 * `config.json` slot map **must** be copied here in the same commit, and
 * `SLOTMAP_VERSION` below is what makes a missed copy visible at runtime: the
 * client sends its own version and a mismatch is rejected.
 */

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type Day = (typeof DAYS)[number];

export type SlotMap = Record<string, Record<string, { time: string }>>;

/**
 * Read `config.json` from the repo root.
 *
 * Read with `fs` rather than a static `import` because a JSON import needs a
 * `type: "json"` attribute under bare Node ESM but not under webpack, and this
 * module needs to be importable from a plain Node script for verification.
 * `import.meta.url` is used so the path does not depend on the cwd.
 */
function loadConfig(): { slotMap?: SlotMap; semesterIDs?: string[] } {
  const fromModule = fileURLToPath(new URL("../../config.json", import.meta.url));
  const fromCwd = path.join(process.cwd(), "config.json");
  for (const candidate of [fromModule, fromCwd]) {
    try {
      return JSON.parse(readFileSync(candidate, "utf8"));
    } catch {
      // try the next candidate
    }
  }
  throw new Error(
    `config.json not found (looked at ${fromModule} and ${fromCwd}). ` +
      `The slot vocabulary is required; refusing to start with an empty one.`
  );
}

const config = loadConfig();

const slotMap: SlotMap = config.slotMap ?? {};

export const SLOT_MAP: SlotMap = slotMap;

/** Flat `"DAY:SLOTID"` set. Every key the server will ever accept. */
export const VALID_KEYS: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (const day of DAYS) {
    for (const id of Object.keys(slotMap[day] ?? {})) set.add(`${day}:${id}`);
  }
  return set;
})();

export const TOTAL_SLOTS = VALID_KEYS.size;

export function isValidKey(key: string): boolean {
  return VALID_KEYS.has(key);
}

/**
 * Stable fingerprint of the vocabulary. Computed identically on the client —
 * see `src/lib/social/schedule.ts` — so the two sides can detect that they
 * disagree without transmitting the whole map.
 */
export const SLOTMAP_VERSION: string = (() => {
  const canonical = Array.from(VALID_KEYS).sort().join(",");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
})();

/**
 * Every day on which a bare slot id is valid.
 *
 * VTOP returns slot ids without days, so each one has to be fanned out. This
 * is the authoritative expansion — the client derives the same set from the
 * same `config.json`.
 */
export function daysForSlot(slotId: string): Day[] {
  const out: Day[] = [];
  for (const day of DAYS) {
    if (slotMap[day]?.[slotId]) out.push(day);
  }
  return out;
}

export function slotTime(key: string): string | null {
  const [day, id] = key.split(":");
  return slotMap[day ?? ""]?.[id ?? ""]?.time ?? null;
}

/** `"MON"` from `"MON:A1"`, or null when the key is malformed. */
export function dayOf(key: string): Day | null {
  const [day] = key.split(":");
  return (DAYS as readonly string[]).includes(day ?? "") ? (day as Day) : null;
}
