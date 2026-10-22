import { describe, it, expect } from "vitest";
import { buildOccupancyIndex, computeDayAvailability } from "./roomAvailability";
import type { RoomRecord, StoredClass } from "./classDetails";

/**
 * The finding itself: which rooms are free.
 *
 * The load-bearing cases are the ones that were wrong before. A bare slot id is
 * ambiguous — `A1` is 8:00 on Monday and 8:55 on Wednesday — so a class has to
 * be busy on every day its slot exists. And the law school books `A+TA+TAA`
 * where everybody else books `A1+TA1+TAA1`, so a comparison of strings alone
 * leaves every law room reading as free all morning.
 */

const room = (code: string, kind: "theory" | "lab" = "theory"): RoomRecord => ({
  code,
  block: code.split("-")[0],
  kind,
});

const cls = (over: Partial<StoredClass>): StoredClass => ({
  semesterId: "CH20262701",
  classId: "C1",
  courseCode: "BACSE102",
  courseTitle: "Problem Solving Using Java",
  ltpjc: "0 0 3 0 3",
  category: "",
  component: "lab",
  slotRaw: "L31",
  slotIds: ["L31"],
  venue: "AB1-101",
  faculty: "Faculty Name",
  ...over,
});

const ROOMS: RoomRecord[] = [
  room("AB1-101"),
  room("AB1-102"),
  room("AB3-205", "lab"),
  room("AB5-208"),
];

describe("buildOccupancyIndex", () => {
  it("files a class under every day its slot exists", () => {
    // A1 exists on Monday and on Wednesday, at different times.
    const index = buildOccupancyIndex([cls({ slotIds: ["A1"] })]);
    expect(index.get("MON:A1")).toHaveLength(1);
    expect(index.get("WED:A1")).toHaveLength(1);
    expect(index.get("TUE:A1")).toBeUndefined();
  });

  it("leaves out a class with no room", () => {
    const index = buildOccupancyIndex([cls({ venue: "" })]);
    expect(index.size).toBe(0);
  });
});

describe("computeDayAvailability", () => {
  it("removes the rooms that are taken and keeps the rest", () => {
    const result = computeDayAvailability({
      day: "MON",
      periods: [{ key: "8:00am-8:50am", slots: ["A1", "L1"] }],
      classes: [
        cls({ classId: "C1", slotIds: ["A1"], venue: "AB1-101" }),
        cls({ classId: "C2", slotIds: ["L1"], venue: "AB3-205", component: "lab" }),
      ],
      rooms: ROOMS,
    });

    const period = result.periods[0];
    expect(period.free).toEqual(["AB1-102", "AB5-208"]);
    expect(period.theory).toEqual(["AB1-102", "AB5-208"]);
    expect(period.lab).toEqual([]);
    expect(period.occupied.map((o) => o.code)).toEqual(["AB1-101", "AB3-205"]);
  });

  it("reports the occupant of a taken room", () => {
    const result = computeDayAvailability({
      day: "MON",
      periods: [{ key: "8:00am-8:50am", slots: ["A1"] }],
      classes: [
        cls({
          classId: "C1",
          slotIds: ["A1"],
          venue: "AB1-101",
          courseCode: "BCSE101L",
          courseTitle: "Computer Programming",
          faculty: "Dr Faculty",
          component: "lab",
        }),
      ],
      rooms: ROOMS,
    });

    expect(result.periods[0].occupied[0]).toMatchObject({
      code: "AB1-101",
      classId: "C1",
      courseCode: "BCSE101L",
      title: "Computer Programming",
      faculty: "Dr Faculty",
    });
  });

  it("matches the law school's spelling of a period", () => {
    // The class was booked "A", which is not a slot id at all.
    const result = computeDayAvailability({
      day: "MON",
      periods: [{ key: "8:00am-8:50am", slots: ["A"] }],
      classes: [cls({ classId: "LAW1", slotIds: ["A1"], venue: "AB5-208" })],
      rooms: ROOMS,
    });

    expect(result.periods[0].free).not.toContain("AB5-208");
    expect(result.periods[0].occupied.map((o) => o.code)).toEqual(["AB5-208"]);
  });

  it("counts the free rooms per block", () => {
    const result = computeDayAvailability({
      day: "MON",
      periods: [{ key: "8:00am-8:50am", slots: ["A1"] }],
      classes: [cls({ classId: "C1", slotIds: ["A1"], venue: "AB1-101" })],
      rooms: ROOMS,
    });

    const blocks = result.periods[0].blocks;
    expect(blocks[0]).toMatchObject({ block: "AB1", total: 2, free: 1 });
    expect(blocks.map((b) => b.block)).toEqual(["AB1", "AB3", "AB5"]);
  });

  it("answers a run as the rooms free for all of it", () => {
    const result = computeDayAvailability({
      day: "MON",
      periods: [
        { key: "8:00am-8:50am", slots: ["A1"] },
        { key: "8:55am-9:45am", slots: ["F1"] },
      ],
      classes: [cls({ classId: "C1", slotIds: ["A1"], venue: "AB1-101" })],
      rooms: ROOMS,
      runLength: 2,
    });

    const run = result.runs[0];
    // AB1-101 is taken in the first period, so it holds out for none of it.
    expect(run.rooms).not.toContain("AB1-101");
    expect(run.runLength["AB1-101"]).toBe(0);
    expect(run.runLength["AB1-102"]).toBe(2);
    expect(run.rooms).toContain("AB1-102");
  });

  it("answers a run starting at the second period", () => {
    const result = computeDayAvailability({
      day: "MON",
      periods: [
        { key: "8:00am-8:50am", slots: ["A1"] },
        { key: "8:55am-9:45am", slots: ["F1"] },
        { key: "9:50am-10:40am", slots: ["D1"] },
      ],
      // Taken in the third period only.
      classes: [cls({ classId: "C1", slotIds: ["D1"], venue: "AB1-101" })],
      rooms: ROOMS,
      runLength: 2,
    });

    // From the first period, the run is the first two periods, and the room is
    // free in both of them.
    expect(result.runs[0].runLength["AB1-101"]).toBe(2);
    expect(result.runs[0].rooms).toContain("AB1-101");

    // From the second period, the run is the second and third periods, and the
    // room is taken in the last of them, so it holds out for one period only.
    expect(result.runs[1].runLength["AB1-101"]).toBe(1);
    expect(result.runs[1].rooms).not.toContain("AB1-101");

    // A room with nothing booked in it holds out for the whole run.
    expect(result.runs[0].runLength["AB1-102"]).toBe(2);
    expect(result.runs[0].rooms).toContain("AB1-102");
  });

  it("does not make a room busy on a day its slot does not run", () => {
    const result = computeDayAvailability({
      day: "TUE",
      periods: [{ key: "8:00am-8:50am", slots: ["B1"] }],
      classes: [cls({ classId: "C1", slotIds: ["A1"], venue: "AB1-101" })],
      rooms: ROOMS,
    });

    // A1 runs on Monday and Wednesday, not Tuesday.
    expect(result.periods[0].free).toContain("AB1-101");
  });
});
