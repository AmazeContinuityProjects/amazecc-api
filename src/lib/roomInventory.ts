/**
 * The room inventory: the rooms the campus has.
 *
 * ## Why this exists
 *
 * The free-room answer is the inventory minus what is booked. Without an
 * inventory, a room nobody has contributed a class for would look free — the
 * opposite of true, and the reason the answer has to come from a list of rooms
 * rather than from the absence of bookings.
 *
 * ## Where it comes from
 *
 * `src/data/roomInventory.json` is generated from the FFCS report by
 * `scripts/build-room-inventory.mjs`. The report is the only complete list of
 * rooms the campus has; it is hand-maintained during registration, which is
 * also why it cannot be the only source of *occupancy* — but it is a good
 * inventory.
 *
 * The seed runs once, lazily, the first time anything reads the inventory. It
 * is idempotent, so a second run costs one count query and no writes.
 */

import inventory from "@/data/roomInventory.json";
import { getDbPool } from "./db";
import { ensureClassSchema, ROOMS_TABLE, type RoomKind } from "./classDetails";

type InventoryEntry = {
  venue: string;
  block: string;
  kind: string;
};

const ENTRIES = inventory as InventoryEntry[];

let seeded: Promise<void> | null = null;

/**
 * Make sure the inventory table holds the campus's rooms.
 *
 * Safe to call on every read: the count query is cheap and the insert only
 * happens when the table is empty.
 */
export function ensureRoomInventory(): Promise<void> {
  if (!seeded) {
    seeded = (async () => {
      await ensureClassSchema();
      const pool = getDbPool();

      const { rows } = await pool.query(
        `SELECT count(*)::int AS count FROM ${ROOMS_TABLE}`
      );
      const count = Number(rows[0]?.count ?? 0);
      if (count > 0) return;

      if (ENTRIES.length === 0) return;

      await pool.query(
        `INSERT INTO ${ROOMS_TABLE} (venue, block, kind)
         SELECT v, b, k
           FROM unnest($1::text[], $2::text[], $3::text[]) AS t(v, b, k)
         ON CONFLICT (venue) DO NOTHING`,
        [
          ENTRIES.map((e) => e.venue),
          ENTRIES.map((e) => e.block),
          ENTRIES.map((e) => (e.kind === "lab" ? "lab" : "theory")),
        ]
      );
      console.log(`rooms: seeded ${ENTRIES.length} rooms into ${ROOMS_TABLE}`);
    })().catch((err: unknown) => {
      // A transient failure must not poison the memo for the life of the instance.
      seeded = null;
      throw err;
    });
  }
  return seeded;
}

/** The kinds the inventory can hold. */
export type { RoomKind };
