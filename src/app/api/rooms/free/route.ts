/**
 * @openapi
 * /api/rooms/free:
 *   post:
 *     tags:
 *       - Rooms
 *     summary: Which rooms are free, computed from the classes students have contributed
 *     description: >
 *       The answer to "which rooms are free" for a given day and set of periods.
 *
 *       The client sends the slots running in each period it is showing — it owns
 *       the campus period schema — and the server does the finding: it turns
 *       those slots into occupied rooms using the class details contributed by
 *       students, subtracts them from the room inventory, and answers with the
 *       free rooms, the classroom/laboratory split, the per-block counts and the
 *       occupants of every taken room.
 *
 *       The response carries no student identity and no owner key: rooms, courses
 *       and faculty, and nothing that says who contributed them.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               semesterId:
 *                 type: string
 *               day:
 *                 type: string
 *                 description: MON, TUE, WED, THU, FRI, SAT or SUN.
 *               periods:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                     slots:
 *                       type: array
 *                       items:
 *                         type: string
 *               runLength:
 *                 type: number
 *                 description: How many consecutive periods a "free for the next N" answer spans.
 *     responses:
 *       200:
 *         description: The free rooms for the requested day.
 *       400:
 *         description: Missing day or periods, or no semester could be resolved.
 *       429:
 *         description: Rate limited.
 */

import { NextResponse } from "next/server";
import { getClientIp, checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { getCachedSemester } from "@/lib/socialDb";
import { loadClassDetails, loadRooms } from "@/lib/classDetails";
import { ensureRoomInventory } from "@/lib/roomInventory";
import { computeDayAvailability, type PeriodRequest } from "@/lib/roomAvailability";
import { DAYS } from "@/lib/socialVocabulary";

/** The periods a client may ask about, one request's worth. */
const MAX_PERIODS = 40;

/** The slots one period may name. */
const MAX_SLOTS_PER_PERIOD = 12;

type Body = {
  semesterId?: string;
  day?: string;
  periods?: PeriodRequest[];
  runLength?: number;
};

function normalisePeriods(raw: unknown): PeriodRequest[] {
  if (!Array.isArray(raw)) return [];
  const out: PeriodRequest[] = [];
  for (const entry of raw.slice(0, MAX_PERIODS)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { key?: unknown; slots?: unknown };
    const key = String(e.key ?? "").trim();
    if (!key) continue;
    const slots = Array.isArray(e.slots)
      ? e.slots
          .map((s) => String(s ?? "").trim().toUpperCase())
          .filter(Boolean)
          .slice(0, MAX_SLOTS_PER_PERIOD)
      : [];
    out.push({ key, slots });
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`rooms-free:${ip}`, 120, 60_000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

    const body = (await req.json().catch(() => ({}))) as Body;

    const day = String(body.day ?? "").trim().toUpperCase();
    if (!day || !(DAYS as readonly string[]).includes(day)) {
      return NextResponse.json(
        { success: false, error: "A day of the week is required." },
        { status: 400 }
      );
    }

    const periods = normalisePeriods(body.periods);
    if (periods.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one period is required." },
        { status: 400 }
      );
    }

    // The client knows which semester it is looking at; when it does not, the
    // server falls back to the campus-wide current semester it has cached.
    let semesterId = String(body.semesterId ?? "").trim();
    if (!semesterId) {
      try {
        semesterId = (await getCachedSemester())?.semesterId ?? "";
      } catch {
        semesterId = "";
      }
    }
    if (!semesterId) {
      return NextResponse.json(
        { success: false, error: "A semesterId is required." },
        { status: 400 }
      );
    }

    const classes = await loadClassDetails(semesterId);
    if (classes.length === 0) {
      // Nothing has been contributed for this term yet. The client falls back to
      // its own timetable rather than showing an empty campus.
      return NextResponse.json({
        success: true,
        noData: true,
        semesterId,
        day,
        rooms: [],
        periods: [],
        runs: [],
      });
    }

    await ensureRoomInventory();
    const rooms = await loadRooms();

    const availability = computeDayAvailability({
      day,
      periods,
      classes,
      rooms,
      runLength: typeof body.runLength === "number" ? body.runLength : 3,
    });

    return NextResponse.json({
      success: true,
      noData: false,
      semesterId,
      ...availability,
    });
  } catch (err: unknown) {
    console.error(
      "rooms/free:",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json(
      { success: false, error: "Could not read the room availability." },
      { status: 500 }
    );
  }
}
