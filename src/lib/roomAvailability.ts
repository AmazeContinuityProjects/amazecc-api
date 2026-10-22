/**
 * Where the free-room answer is actually computed.
 *
 * The client used to answer "which rooms are free?" by scanning every row of a
 * hand-maintained FFCS spreadsheet on every day/period change. That file
 * records what was booked during registration, so a rescheduled lab, a room
 * change or a cancelled section never reached it, and it was stale between
 * registration cycles.
 *
 * This module is the replacement: it takes the classes that students have
 * contributed, the inventory of rooms the campus has, and the periods being
 * asked about, and answers with the rooms that are free.
 *
 * ## The key is `(day, slotId)`, never a bare slot id
 *
 * A bare slot id is ambiguous. `A1` is 8:00 on Monday and 8:55 on Wednesday,
 * and a course booked into `A1` runs in that slot on *every* day the slot
 * exists — at that day's time. So a class is busy on `MON:A1`, `WED:A1` and
 * `FRI:A1`, and the fan-out is the vocabulary's `daysForSlot`.
 *
 * ## Why the periods come from the client
 *
 * The client sends the slots active in each period it is showing (it owns the
 * campus period schema, which merges the overlapping theory and lab windows
 * into the twelve blocks a person would actually describe as "periods"). The
 * server does the rest: it turns those slots into occupied rooms, subtracts
 * them from the inventory, and answers with free rooms, the theory/lab split
 * and the per-block counts.
 */

import { daysForSlot, type Day } from "./socialVocabulary";
import { expandSlotSpellings } from "./slotSpellings";
import type { RoomKind, RoomRecord, StoredClass } from "./classDetails";

export type { RoomKind, RoomRecord };

/** A period as the client describes it: a key and the slots running in it. */
export type PeriodRequest = {
  key: string;
  slots: string[];
};

/** A class sitting in a room, in the shape the inspector renders. */
export type Occupant = {
  /** The room code. */
  code: string;
  classId: string;
  courseCode: string;
  title: string;
  faculty: string;
  component: string;
  /** The class's slots, for display. */
  slots: string[];
};

export type BlockAvailability = {
  block: string;
  freeTheory: string[];
  freeLab: string[];
  total: number;
  free: number;
};

export type PeriodAvailability = {
  key: string;
  slots: string[];
  /** Every room free in this period. */
  free: string[];
  /** The free ones that are classrooms. */
  theory: string[];
  /** The free ones that are laboratories. */
  lab: string[];
  /** What is in the occupied rooms. */
  occupied: Occupant[];
  blocks: BlockAvailability[];
};

export type RunAvailability = {
  startKey: string;
  length: number;
  /** Rooms free for the whole run. */
  rooms: string[];
  /** Room code → how many periods of the run it holds out for. */
  runLength: Record<string, number>;
};

export type DayAvailability = {
  day: string;
  /** The inventory: every room the campus has, with its block and kind. */
  rooms: RoomRecord[];
  periods: PeriodAvailability[];
  /** A run starting at each period, for "free for the next N". */
  runs: RunAvailability[];
};

const compareCodes = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/**
 * Which classes are in which room in which slot.
 *
 * Keyed `(DAY, SLOTID)` because that is the only unambiguous key. A class with
 * no room — VTOP says `NIL` for a course with no venue yet — is left out: it
 * cannot make a room busy.
 */
export function buildOccupancyIndex(
  classes: readonly StoredClass[]
): Map<string, StoredClass[]> {
  const index = new Map<string, StoredClass[]>();
  for (const cls of classes) {
    if (!cls.venue) continue;
    for (const slotId of cls.slotIds) {
      for (const day of daysForSlot(slotId)) {
        const key = `${day}:${slotId}`;
        const list = index.get(key);
        if (list) list.push(cls);
        else index.set(key, [cls]);
      }
    }
  }
  return index;
}

/**
 * The `(day, slot)` keys a period covers.
 *
 * Both spellings of every slot are included, because the law school books
 * `A+TA+TAA` where everybody else books `A1+TA1+TAA1`, and a comparison of
 * strings alone would leave every law room reading as free all morning.
 */
export function periodKeys(day: string, slots: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (const slot of expandSlotSpellings(slots)) {
    keys.add(`${day}:${slot}`);
  }
  return keys;
}

/**
 * Answer for one day.
 *
 * `runLength` is how many consecutive periods a run covers; the server answers
 * for a run starting at *every* period, so the client can switch the selected
 * period without asking again.
 */
export function computeDayAvailability(input: {
  day: Day | string;
  periods: readonly PeriodRequest[];
  classes: readonly StoredClass[];
  rooms: readonly RoomRecord[];
  runLength?: number;
}): DayAvailability {
  const day = String(input.day).toUpperCase();
  const index = buildOccupancyIndex(input.classes);
  const inventory = input.rooms.map((r) => ({ ...r }));
  const byCode = new Map(inventory.map((r) => [r.code, r]));

  const periods: PeriodAvailability[] = input.periods.map((period) => {
    const keys = periodKeys(day, period.slots);

    const occupiedRooms = new Set<string>();
    const occupantByClass = new Map<string, Occupant>();
    for (const key of keys) {
      const list = index.get(key);
      if (!list) continue;
      for (const cls of list) {
        occupiedRooms.add(cls.venue);
        if (occupantByClass.has(cls.classId)) continue;
        occupantByClass.set(cls.classId, {
          code: cls.venue,
          classId: cls.classId,
          courseCode: cls.courseCode,
          title: cls.courseTitle,
          faculty: cls.faculty,
          component: cls.component,
          slots: cls.slotIds,
        });
      }
    }

    const free = inventory
      .map((r) => r.code)
      .filter((code) => !occupiedRooms.has(code))
      .sort(compareCodes);

    const theory = free.filter((code) => byCode.get(code)?.kind !== "lab");
    const lab = free.filter((code) => byCode.get(code)?.kind === "lab");

    return {
      key: period.key,
      slots: [...period.slots],
      free,
      theory,
      lab,
      occupied: [...occupantByClass.values()].sort((a, b) =>
        a.code.localeCompare(b.code)
      ),
      blocks: blockAvailability(inventory, free, byCode),
    };
  });

  const runLength = Math.max(1, input.runLength ?? 3);
  const runs: RunAvailability[] = periods.map((period, i) => {
    const window = periods.slice(i, i + runLength);
    const freeByPeriod = window.map((p) => new Set(p.free));

    const runLengthByRoom: Record<string, number> = {};
    for (const room of inventory.map((r) => r.code)) {
      let held = 0;
      for (const set of freeByPeriod) {
        if (!set.has(room)) break;
        held++;
      }
      runLengthByRoom[room] = held;
    }

    return {
      startKey: period.key,
      length: window.length,
      rooms: Object.entries(runLengthByRoom)
        .filter(([, n]) => n === window.length)
        .map(([code]) => code)
        .sort(compareCodes),
      runLength: runLengthByRoom,
    };
  });

  return { day, rooms: inventory, periods, runs };
}

/**
 * Availability per block, sorted by how empty the block is.
 *
 * Sorted by `free` descending because that is the question being asked: not
 * "which blocks exist" but "where should I walk to". Every block's *total* is
 * carried too, so the occupancy bar can say 12 of 65 rather than just 12.
 */
function blockAvailability(
  inventory: readonly RoomRecord[],
  free: readonly string[],
  byCode: Map<string, RoomRecord>
): BlockAvailability[] {
  const blocks = new Map<string, string[]>();
  for (const room of inventory) {
    const list = blocks.get(room.block);
    if (list) list.push(room.code);
    else blocks.set(room.block, [room.code]);
  }
  blocks.forEach((codes) => codes.sort(compareCodes));

  const out: BlockAvailability[] = [];
  for (const [block, codes] of blocks) {
    const freeTheory: string[] = [];
    const freeLab: string[] = [];
    for (const code of codes) {
      if (!free.includes(code)) continue;
      (byCode.get(code)?.kind === "lab" ? freeLab : freeTheory).push(code);
    }
    const freeCount = freeTheory.length + freeLab.length;
    if (freeCount === 0) continue;
    out.push({
      block,
      freeTheory,
      freeLab,
      total: codes.length,
      free: freeCount,
    });
  }

  return out.sort((a, b) => b.free - a.free || a.block.localeCompare(b.block));
}
