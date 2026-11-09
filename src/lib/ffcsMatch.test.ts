import { describe, expect, it } from "vitest";
import {
  computeMatches,
  MAX_PLAN_CLASSES,
  normaliseClassIds,
  slotTokens,
  validatePlan,
  type MatchCandidate,
} from "./ffcsMatch";
import { isSupportedSemester, parseCsv, parseReport } from "./ffcsReport";

const SEM = "CH20262705";

// Mirrors the real report's columns, including a quoted title with commas.
const CSV = [
  "COURSE CODE,COURSE TITLE,TYPE,CREDITS,CLASS ID,ROOM,SLOT,ERP ID,EMPLOYEE NAME,EMPLOYEE SCHOOL",
  'BACSE211,"Robotics: Kinematics, Dynamics and Motion Control",ETH,3,CH2026270501792,AB3-308,B1+TB1,51651,MUTHUKUMAR AN K,SCOPE',
  'BACSE211,"Robotics: Kinematics, Dynamics and Motion Control",ETH,3,CH2026270501793,AB3-309,B1+TB1,54767,AKKARAPAKAM SUNEESH JACOB,SCOPE',
  'BACSE211,"Robotics: Kinematics, Dynamics and Motion Control",ELA,1,CH2026270501800,AB1-LAB,L31+L32,51651,MUTHUKUMAR AN K,SCOPE',
  "BAMAT101,Calculus,TH,4,CH2026270500100,AB2-101,A1+TA1,50001,RAMAN K,SAS",
  "BAMAT101,Calculus,TH,4,CH2026270500101,AB2-102,B1+TB1,50002,PRIYA S,SAS",
  "BAPHY105,Physics,TH,3,CH2026270500200,AB1-201,C1+TC1,50003,\"KUMAR \"\"KK\"\" K\",SAS",
  "BAENG101,Technical English,SS,1,CH2026270500300,AB3-001,A1,50004,ANITHA R,SSL",
  "BAPRJ199,Mini Project,PJT,2,CH2026270500400,NIL,NIL,50005,GUIDE G,SCOPE",
  "BAPRJ299,Design Project,PJT,2,CH2026270500401,NIL,NIL,50006,GUIDE H,SCOPE",
].join("\r\n");

const offerings = parseReport(CSV);

describe("parseCsv / parseReport", () => {
  it("keeps commas and doubled quotes inside quoted fields", () => {
    const rows = parseCsv('a,"b, c","say ""hi"""\n1,2,3\n');
    expect(rows).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });

  it("reads columns by header name and keys offerings by class id", () => {
    expect(offerings.size).toBe(9);
    const robotics = offerings.get("CH2026270501792")!;
    expect(robotics.title).toBe("Robotics: Kinematics, Dynamics and Motion Control");
    expect(robotics.slot).toBe("B1+TB1");
    expect(robotics.faculty).toBe("MUTHUKUMAR AN K");
    expect(offerings.get("CH2026270500200")!.faculty).toBe('KUMAR "KK" K');
  });

  it("refuses a file without the columns it needs", () => {
    expect(() => parseReport("A,B\n1,2")).toThrow(/CLASS ID/);
  });

  it("supports only semesters with a report", () => {
    expect(isSupportedSemester("CH20262705")).toBe(true);
    expect(isSupportedSemester("CH20262701")).toBe(false);
    expect(isSupportedSemester("CH19990101")).toBe(false);
    expect(isSupportedSemester(42)).toBe(false);
    expect(isSupportedSemester("constructor")).toBe(false);
  });
});

describe("slotTokens / normaliseClassIds", () => {
  it("splits combined slots and ignores NIL", () => {
    expect(slotTokens("B1+TB1")).toEqual(["B1", "TB1"]);
    expect(slotTokens("NIL")).toEqual([]);
  });

  it("sorts, upper-cases and de-duplicates", () => {
    expect(normaliseClassIds(["ch2", "CH1", "CH2 "])).toEqual(["CH1", "CH2"]);
  });
});

describe("validatePlan", () => {
  it("accepts a plan a student could register", () => {
    const v = validatePlan(
      ["CH2026270501792", "CH2026270501800", "CH2026270500200", "CH2026270500400", "CH2026270500401"],
      SEM,
      offerings
    );
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.classIds).toHaveLength(5);
  });

  it("rejects non-arrays, empty plans and oversize plans", () => {
    expect(validatePlan("CH2026270501792", SEM, offerings)).toMatchObject({ ok: false, error: "invalid_plan" });
    expect(validatePlan([1, 2], SEM, offerings)).toMatchObject({ ok: false, error: "invalid_plan" });
    expect(validatePlan([], SEM, offerings)).toMatchObject({ ok: false, error: "empty_plan" });
    const big = Array.from({ length: MAX_PLAN_CLASSES + 1 }, (_, i) => `CH20262705${String(i).padStart(5, "0")}`);
    expect(validatePlan(big, SEM, offerings)).toMatchObject({ ok: false, error: "plan_too_large" });
  });

  it("rejects malformed, other-semester and unoffered ids", () => {
    expect(validatePlan(["DROP TABLE"], SEM, offerings)).toMatchObject({ error: "invalid_class_id" });
    expect(validatePlan(["CH2026270100011"], SEM, offerings)).toMatchObject({ error: "semester_mismatch" });
    expect(validatePlan(["CH2026270599999"], SEM, offerings)).toMatchObject({
      error: "class_not_offered",
      offending: ["CH2026270599999"],
    });
  });

  it("rejects two sections of the same course component", () => {
    expect(validatePlan(["CH2026270501792", "CH2026270501793"], SEM, offerings)).toMatchObject({
      ok: false,
      error: "duplicate_course",
    });
  });

  it("allows the theory and lab of one embedded course together", () => {
    expect(validatePlan(["CH2026270501792", "CH2026270501800"], SEM, offerings).ok).toBe(true);
  });

  it("rejects slot clashes across courses", () => {
    // BACSE211 ETH B1+TB1 vs BAMAT101 B1+TB1.
    expect(validatePlan(["CH2026270501792", "CH2026270500101"], SEM, offerings)).toMatchObject({
      ok: false,
      error: "slot_clash",
    });
    // A partial clash: BAMAT101 A1+TA1 vs BAENG101 A1.
    expect(validatePlan(["CH2026270500100", "CH2026270500300"], SEM, offerings)).toMatchObject({
      error: "slot_clash",
    });
  });
});

describe("computeMatches", () => {
  const mine = ["CH2026270501792", "CH2026270500200", "CH2026270500300"];
  const person = (
    handle: string,
    name: string,
    classIds: string[],
    source: "planned" | "registered" = "planned",
    regNo: string = "22BCE1234"
  ): MatchCandidate => ({
    handle,
    name,
    regNo,
    source,
    classIds,
    updatedAt: "2026-11-07T00:00:00.000Z",
  });

  it("lists every one of my sections, with whoever shares it", () => {
    const r = computeMatches(
      mine,
      [person("AMZ-B", "Bala", ["CH2026270501792"]), person("AMZ-A", "Asha", ["CH2026270501792", "CH2026270599999"])],
      offerings
    );
    expect(r.sections.map((s) => s.classId)).toEqual(normaliseClassIds(mine));
    const robotics = r.sections.find((s) => s.classId === "CH2026270501792")!;
    expect(robotics.people.map((p) => p.name)).toEqual(["Asha", "Bala"]);
    expect(robotics.offering?.code).toBe("BACSE211");
    expect(r.sections.find((s) => s.classId === "CH2026270500300")!.people).toEqual([]);
  });

  it("ranks identical timetables first, then by shared count, and skips single overlaps", () => {
    const r = computeMatches(
      mine,
      [
        person("AMZ-1", "One", ["CH2026270501792"]),
        person("AMZ-2", "Two", ["CH2026270501792", "CH2026270500200", "CH2026270500401"]),
        person("AMZ-3", "Three", [...mine].reverse(), "registered"),
        person("AMZ-4", "Four", ["CH2026270501792", "CH2026270500300"]),
      ],
      offerings
    );
    expect(r.overlaps.map((o) => [o.handle, o.shared, o.identical])).toEqual([
      ["AMZ-3", 3, true],
      ["AMZ-4", 2, false],
      ["AMZ-2", 2, false],
    ]);
    expect(r.overlaps[0].source).toBe("registered");
  });

  it("does not call a superset an identical timetable", () => {
    const r = computeMatches(["CH2026270501792"], [person("AMZ-X", "X", ["CH2026270501792", "CH2026270500200"])], offerings);
    expect(r.overlaps).toEqual([]);
  });

  it("carries regNo into both sections[].people and overlaps", () => {
    const r = computeMatches(
      mine,
      [person("AMZ-B", "Bala", ["CH2026270501792", "CH2026270500200"], "registered", "22BCE9999")],
      offerings
    );
    const shared = r.sections.find((s) => s.people.length)!.people[0];
    expect(shared.regNo).toBe("22BCE9999");
    expect(shared.name).toBe("Bala");
    expect(shared.handle).toBe("AMZ-B");

    expect(r.overlaps).toHaveLength(1);
    expect(r.overlaps[0].regNo).toBe("22BCE9999");

    const section = r.sections.find((s) => s.classId === "CH2026270501792")!;
    expect(section.registerNos).toEqual(["22BCE9999"]);
  });
});
