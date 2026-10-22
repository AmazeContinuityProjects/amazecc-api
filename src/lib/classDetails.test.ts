import { describe, it, expect } from "vitest";
import {
  blockOf,
  cleanVenue,
  componentOf,
  deriveClassDetails,
} from "./classDetails";
import type { courseItem } from "@/types/data/attendance";

/**
 * Deriving the class rows from a student's timetable.
 *
 * The messy parts of the VTOP timetable live here: the course cell is a
 * sentence, the slot cell is two things separated by a dash, and the law school
 * spells its slots without the number the rest of the campus uses.
 */

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

describe("deriveClassDetails", () => {
  it("splits a course cell into a code, a title and a component", () => {
    const rows = deriveClassDetails([
      course({
        course: "BACSE102 - Problem Solving Using Java ( Lab Only )",
        courseCode: "BACSE102(L)",
        classId: "CH2026270102069",
        slotVenue: "L31+L32 - AB1-607B",
        facultyDetails: "Dr Faculty Name",
        LTPJC: "0 0 3 0 3",
        category: "University Core Courses",
      }),
    ]);

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.classId).toBe("CH2026270102069");
    expect(row.courseCode).toBe("BACSE102");
    expect(row.courseTitle).toBe("Problem Solving Using Java");
    expect(row.component).toBe("lab");
    expect(row.slotIds).toEqual(["L31", "L32"]);
    expect(row.slotRaw).toBe("L31+L32");
    expect(row.venue).toBe("AB1-607B");
    expect(row.faculty).toBe("Dr Faculty Name");
    expect(row.ltpjc).toBe("0 0 3 0 3");
    expect(row.category).toBe("University Core Courses");
  });

  it("keeps the law school's slots, canonicalised", () => {
    const rows = deriveClassDetails([
      course({
        course: "TLAW203L - Constitutional Law- I ( Embedded Theory )",
        courseCode: "TLAW203L(T)",
        classId: "CH2026270109001",
        slotVenue: "A+TA+TAA - AB5-101",
      }),
    ]);

    expect(rows[0].slotIds).toEqual(["A1", "TA1", "TAA1"]);
    expect(rows[0].slotRaw).toBe("A+TA+TAA");
    expect(rows[0].venue).toBe("AB5-101");
  });

  it("drops a class that has no class number", () => {
    const rows = deriveClassDetails([
      course({ classId: "  ", slotVenue: "A1 - AB1-101" }),
    ]);
    expect(rows).toHaveLength(0);
  });

  it("keeps one row per class, even when the timetable repeats it", () => {
    const rows = deriveClassDetails([
      course({ classId: "X1", slotVenue: "A1 - AB1-101" }),
      course({ classId: "X1", slotVenue: "A1 - AB1-101" }),
    ]);
    expect(rows).toHaveLength(1);
  });

  it("keeps a class that has no room, with an empty venue", () => {
    const rows = deriveClassDetails([
      course({
        classId: "X2",
        course: "NIL - A Course With No Room",
        slotVenue: "NIL",
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].venue).toBe("");
    expect(rows[0].slotIds).toEqual([]);
  });
});

describe("cleanVenue", () => {
  it("trims and upper-cases", () => {
    // Six venues in the FFCS report carry a trailing space, and without the
    // trim "AB3 " and "AB3" become two rooms.
    expect(cleanVenue(" ab3-205 ")).toBe("AB3-205");
  });

  it("rejects the things that are not rooms", () => {
    expect(cleanVenue("NIL")).toBe("");
    expect(cleanVenue("UNK-UNK")).toBe("");
    expect(cleanVenue("N/A")).toBe("");
    expect(cleanVenue("")).toBe("");
    expect(cleanVenue("ONLINE-1")).toBe("");
  });
});

describe("blockOf", () => {
  it("is everything before the dash", () => {
    expect(blockOf("AB5-208")).toBe("AB5");
  });

  it("is Other for a room with no block", () => {
    expect(blockOf("1")).toBe("Other");
  });
});

describe("componentOf", () => {
  it("trusts the code suffix first", () => {
    expect(componentOf("BACSE102(L)", "", ["L31"])).toBe("lab");
    expect(componentOf("BACSE102(T)", "", ["A1"])).toBe("theory");
  });

  it("falls back to the component type", () => {
    expect(componentOf("BACSE102", "Lab Only", ["A1"])).toBe("lab");
    expect(componentOf("BACSE102", "Embedded Theory", ["A1"])).toBe("theory");
  });

  it("falls back to the slots", () => {
    expect(componentOf("BACSE102", "", ["L31"])).toBe("lab");
    expect(componentOf("BACSE102", "", ["A1"])).toBe("");
  });
});
