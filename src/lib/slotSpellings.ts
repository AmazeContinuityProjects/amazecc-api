/**
 * Slot id spellings: the engineering grid's and the law school's.
 *
 * A slot id names one period of one day. The engineering grid suffixes a `1` for
 * the morning and a `2` for the evening — `A1` is Monday 8:00, `A2` is Monday
 * 2:00 — and two of the 12:35 periods are spelled with an `S` id instead
 * (`S11` Monday, `S15` Friday).
 *
 * The law school books those same morning periods with the number left off
 * entirely: `A+TA+TAA` where everybody else writes `A1+TA1+TAA1`, `C+TC+TCC`
 * for `C1+TC1+TCC1`, and `E+TE+TEE` for `E1+TE1+TEE1`. The law school has no
 * evening timetable at all, so a law slot only ever names a morning period.
 *
 * ## This is a port, and it has to stay one
 *
 * The original lives in the client at `AmazeCC/src/lib/slots.ts`. It is copied
 * here rather than imported because the two repos are separate deployments and
 * the server cannot reach the client's source. The copy is the reason this file
 * says where it came from: `src/lib/slotSpellings.test.ts` pins the same
 * expectations the client pins, so a change on one side that is not made on the
 * other shows up as a failing test rather than as law courses that silently
 * stop being found.
 *
 * The silent failure is the dangerous one. A law course booked as `A` does not
 * appear in the slot vocabulary at all, so a lookup that compares strings finds
 * no day for it and the class is recorded as running on no day, ever. It is 99
 * rows of the FFCS report, it owns the whole of AB5, and before this the
 * free-classroom page reported every law room free all morning while a class
 * was sitting in it.
 */

import { daysForSlot } from "./socialVocabulary";

/**
 * The two law slots the Chennai grid spells with an `S` id rather than a letter.
 *
 * The law grid runs a third period after `TAA`/`TBB`/`TCC`/`TDD`, and the last
 * two of them do not fall on an 11:40 period — they are the two 12:35 periods
 * the schema gives an `S` id. Stated rather than derived because there is
 * nothing in the schema to derive it *from*: `S11` and `S15` are just two
 * strings, and the link to `TEE`/`TFF` is knowledge about the law timetable.
 */
const LAW_SLOT_BY_S_SLOT: Record<string, string> = {
  S11: "TEE",
  S15: "TFF",
};

/**
 * Ids that look like a law slot but are not, and so must not be treated as one.
 * `NIL` is VTOP's "this course has no slot" placeholder, and a bare `S`/`L` is
 * not a law slot in any reading.
 */
const NOT_A_LAW_SLOT = new Set(["NIL", "S", "L"]);

/** Upper-cased and trimmed, which is how every slot id is compared. */
function normalise(slot: string): string {
  return String(slot ?? "")
    .trim()
    .toUpperCase();
}

/**
 * The law school's spelling of a schema slot id, or null when there is none.
 *
 * `A1` → `A`, `TC1` → `TC`, `S11` → `TEE`. This is the direction a caller needs
 * when it already has a period and wants to know who might be in it.
 */
export function lawSlotFor(schemaSlot: string): string | null {
  const id = normalise(schemaSlot);
  if (!id) return null;
  if (LAW_SLOT_BY_S_SLOT[id]) return LAW_SLOT_BY_S_SLOT[id];
  // A lone trailing 1, and only a lone one. `A2` is the evening and must not be
  // aliased, or a law course would mark itself busy from 2pm on; `S11` carries
  // two digits and is handled by the table above; `L1` is a lab with no law
  // equivalent; and `S1` is a real 6:35pm theory slot that fits this shape but
  // is not one of the law family's.
  const stripped = id.match(/^([A-Z]+)1$/);
  if (!stripped || stripped[1] === "S" || stripped[1] === "L") return null;
  return stripped[1];
}

/**
 * The schema's spelling of a law slot id, or null when there is none.
 *
 * `A` → `A1`, `TAA` → `TAA1`, `TEE` → `S11`. This is the direction a caller
 * needs when it already has a course and wants to know when it runs.
 */
export function schemaSlotFor(lawSlot: string): string | null {
  const id = normalise(lawSlot);
  if (!id || !/^[A-Z]+$/.test(id) || NOT_A_LAW_SLOT.has(id)) return null;
  for (const [schemaSlot, law] of Object.entries(LAW_SLOT_BY_S_SLOT)) {
    if (law === id) return schemaSlot;
  }
  return `${id}1`;
}

/**
 * Every id that names the same period as `slot`, `slot` itself included.
 *
 * Both spellings, because which way round the question arrives depends on the
 * caller: the free-classroom page holds a period and asks who is in it, while
 * the generator holds a course and asks when it runs. A period that answers to
 * two names has to answer to both in either direction.
 */
export function slotSpellings(slot: string): string[] {
  const id = normalise(slot);
  if (!id) return [];
  const spellings = new Set([id]);
  const law = lawSlotFor(id);
  if (law) spellings.add(law);
  const schema = schemaSlotFor(id);
  if (schema) spellings.add(schema);
  return [...spellings];
}

/**
 * A set holding every spelling of every id given, so one `has` answers for both.
 */
export function expandSlotSpellings(slots: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const slot of slots) {
    for (const spelling of slotSpellings(slot)) out.add(spelling);
  }
  return out;
}

/**
 * The vocabulary spelling of a slot token, or null when it names no period.
 *
 * This is the direction the write path needs. VTOP hands back `A` for a law
 * course, and `A` is not a slot id in `config.json` — `daysForSlot("A")` is
 * empty — so the class would be filed as running on no day at all. Canonical
 * first (`A` → `A1`), and only then ask the vocabulary.
 *
 * `L31` is a lab slot and stays `L31`; `NIL` is VTOP's "no slot" placeholder
 * and names nothing.
 */
export function canonicalSlotId(slot: string): string | null {
  const id = normalise(slot);
  if (!id) return null;
  if (NOT_A_LAW_SLOT.has(id)) return null;
  if (daysForSlot(id).length > 0) return id;
  const schema = schemaSlotFor(id);
  if (schema && daysForSlot(schema).length > 0) return schema;
  return null;
}

/**
 * The canonical spelling of every token in a `+`-joined slot string.
 *
 * Tokens that name no period are dropped rather than kept: an unknown id in the
 * set would match nothing anyway, and keeping it would make a stored class look
 * like it runs on a day it does not.
 */
export function canonicalSlotIds(slots: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const slot of slots) {
    const canonical = canonicalSlotId(slot);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}
