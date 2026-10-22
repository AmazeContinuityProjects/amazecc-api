import { describe, it, expect } from "vitest";
import {
  canonicalSlotId,
  canonicalSlotIds,
  expandSlotSpellings,
  lawSlotFor,
  schemaSlotFor,
  slotSpellings,
} from "./slotSpellings";

/**
 * The law school's spelling of a period.
 *
 * These are the expectations the client pins in its own copy of this logic
 * (`AmazeCC/src/lib/slots.ts`). If one side changes and the other does not,
 * every `TLAW*` class silently stops being found — and the failure is invisible
 * rather than loud, because the class is simply recorded as running on no day.
 */
describe("lawSlotFor", () => {
  it("drops the trailing one for the morning slots", () => {
    expect(lawSlotFor("A1")).toBe("A");
    expect(lawSlotFor("TA1")).toBe("TA");
    expect(lawSlotFor("TAA1")).toBe("TAA");
  });

  it("leaves the evening slots alone", () => {
    // A2 is the 2pm slot. Aliasing it to "A" would make a law course look
    // busy from the afternoon onwards.
    expect(lawSlotFor("A2")).toBeNull();
  });

  it("leaves lab slots and S1 alone", () => {
    expect(lawSlotFor("L1")).toBeNull();
    expect(lawSlotFor("S1")).toBeNull();
  });

  it("maps the two S-id slots to the law names", () => {
    expect(lawSlotFor("S11")).toBe("TEE");
    expect(lawSlotFor("S15")).toBe("TFF");
  });
});

describe("schemaSlotFor", () => {
  it("puts the one back", () => {
    expect(schemaSlotFor("A")).toBe("A1");
    expect(schemaSlotFor("TAA")).toBe("TAA1");
  });

  it("maps the law names of the S-id slots back", () => {
    expect(schemaSlotFor("TEE")).toBe("S11");
    expect(schemaSlotFor("TFF")).toBe("S15");
  });

  it("refuses the placeholders", () => {
    expect(schemaSlotFor("NIL")).toBeNull();
    expect(schemaSlotFor("S")).toBeNull();
    expect(schemaSlotFor("L")).toBeNull();
  });
});

describe("slotSpellings", () => {
  it("answers for both names of a period", () => {
    const spellings = slotSpellings("A1");
    expect(spellings).toContain("A1");
    expect(spellings).toContain("A");
  });

  it("answers for both names in either direction", () => {
    const spellings = slotSpellings("A");
    expect(spellings).toContain("A");
    expect(spellings).toContain("A1");
  });

  it("expands a whole list into one set", () => {
    const set = expandSlotSpellings(["A1", "L31"]);
    expect(set.has("A1")).toBe(true);
    expect(set.has("A")).toBe(true);
    expect(set.has("L31")).toBe(true);
  });
});

describe("canonicalSlotId", () => {
  it("leaves a vocabulary id alone", () => {
    expect(canonicalSlotId("A1")).toBe("A1");
    expect(canonicalSlotId("L31")).toBe("L31");
    expect(canonicalSlotId("S11")).toBe("S11");
  });

  it("canonicalises the law spelling", () => {
    // "A" is not a slot id at all: daysForSlot("A") is empty, which is exactly
    // why the law school used to be invisible.
    expect(canonicalSlotId("A")).toBe("A1");
    expect(canonicalSlotId("TA")).toBe("TA1");
    expect(canonicalSlotId("TAA")).toBe("TAA1");
    expect(canonicalSlotId("TEE")).toBe("S11");
  });

  it("drops the placeholders", () => {
    expect(canonicalSlotId("NIL")).toBeNull();
    expect(canonicalSlotId("")).toBeNull();
    expect(canonicalSlotId("   ")).toBeNull();
  });

  it("drops an id that names no period", () => {
    expect(canonicalSlotId("ZZ99")).toBeNull();
  });

  it("canonicalises a whole slot string, keeping the order", () => {
    expect(canonicalSlotIds(["A", "TA", "TAA"])).toEqual([
      "A1",
      "TA1",
      "TAA1",
    ]);
  });

  it("does not repeat a slot that appears twice", () => {
    expect(canonicalSlotIds(["A1", "A"])).toEqual(["A1"]);
  });
});
