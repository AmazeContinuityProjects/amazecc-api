import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDbPool } from "./db";
import {
  alreadyContributed,
  deriveClassDetails,
  ensureClassSchema,
  loadClassDetails,
  loadRooms,
  recordClassDetails,
} from "./classDetails";
import { ensureRoomInventory } from "./roomInventory";
import { computeDayAvailability } from "./roomAvailability";
import type { courseItem } from "@/types/data/attendance";

/**
 * The write and read path, against the real database.
 *
 * ## Why this exists
 *
 * The unit tests run against a fake pool that never parses the SQL, so they
 * cannot catch the class of mistake that matters most here: a statement that
 * is syntactically wrong, a `text[]` that does not round-trip, a transaction
 * that does not roll back what it should. That mistake is invisible until the
 * route is called in production, which is exactly where it is most expensive.
 *
 * ## What it does to the database
 *
 * It writes rows under a made-up semester id (`ZZTESTROOM`) and a made-up
 * owner key, and deletes them afterwards. The tables themselves are the ones
 * the feature uses, so creating them is the point.
 *
 * ## How to run it
 *
 *   LIVE_DB=1 npx vitest run src/lib/classDetails.live.test.ts
 *
 * It is skipped unless `LIVE_DB=1`, so an ordinary test run never touches the
 * database.
 */

const LIVE = process.env.LIVE_DB === "1";
const SEMESTER = "ZZTESTROOM";
const OWNER = "live-test-owner-key";

const course = (over: Partial<courseItem>): courseItem => ({
  slNo: "1",
  course: "",
  courseCode: "",
  LTPJC: "",
  category: "",
  classId: "",
  slotVenue: "",
  facultyDetails: "",
  ...over,
});

describe.skipIf(!LIVE)("class details, against the real database", () => {
  beforeAll(async () => {
    await ensureClassSchema();
    await ensureRoomInventory();
  });

  afterAll(async () => {
    const pool = getDbPool();
    await pool.query(`DELETE FROM class_details WHERE semester_id = $1`, [SEMESTER]);
    await pool.query(`DELETE FROM class_sync_state WHERE owner_key = $1`, [OWNER]);
  });

  it("records a contribution once and reads it back", async () => {
    const rows = deriveClassDetails([
      course({
        course: "BACSE102 - Problem Solving Using Java ( Lab Only )",
        courseCode: "BACSE102(L)",
        classId: "ZZTESTCLASS1",
        slotVenue: "L31+L32 - AB1-607B",
        facultyDetails: "Dr Live Faculty",
        LTPJC: "0 0 3 0 3",
      }),
      course({
        course: "BCSE101L - Programming Lab ( Lab Only )",
        courseCode: "BCSE101L(L)",
        classId: "ZZTESTCLASS2",
        slotVenue: "L33 - AB1-608",
        facultyDetails: "Dr Live Faculty Two",
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].slotIds).toEqual(["L31", "L32"]);
    expect(rows[0].venue).toBe("AB1-607B");

    expect(await alreadyContributed(OWNER, SEMESTER)).toBe(false);

    const first = await recordClassDetails(OWNER, SEMESTER, rows, Date.now());
    expect(first.recorded).toBe(true);
    expect(first.classes).toBe(2);

    // The gate: a second sync of the same term writes nothing.
    const second = await recordClassDetails(OWNER, SEMESTER, rows, Date.now());
    expect(second.recorded).toBe(false);
    expect(second.skipped).toBe(true);
    expect(await alreadyContributed(OWNER, SEMESTER)).toBe(true);

    // The read path.
    const stored = await loadClassDetails(SEMESTER);
    expect(stored).toHaveLength(2);
    const firstRow = stored.find((s) => s.classId === "ZZTESTCLASS1");
    expect(firstRow?.slotIds).toEqual(["L31", "L32"]);
    expect(firstRow?.venue).toBe("AB1-607B");
    expect(firstRow?.faculty).toBe("Dr Live Faculty");
    expect(firstRow?.courseTitle).toBe("Problem Solving Using Java");
    expect(firstRow?.component).toBe("lab");

    // The inventory.
    const rooms = await loadRooms();
    expect(rooms.length).toBeGreaterThan(100);
    expect(rooms.some((r) => r.code === "AB1-607B")).toBe(true);

    // The finding: the two labs are taken in the Monday afternoon lab block,
    // and the rest of the campus is not.
    const availability = computeDayAvailability({
      day: "MON",
      periods: [{ key: "2:00pm-2:50pm", slots: ["L31", "L32", "L33"] }],
      classes: stored,
      rooms,
    });
    const period = availability.periods[0];
    expect(period.occupied.map((o) => o.code).sort()).toEqual([
      "AB1-607B",
      "AB1-608",
    ]);
    expect(period.free).not.toContain("AB1-607B");
  });
});
