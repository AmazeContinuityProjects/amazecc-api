/**
 * @openapi
 * /api/social/ffcs-match:
 *   post:
 *     tags:
 *       - Social
 *     summary: FFCS friend finder. Find who shares your sections.
 *     description: >
 *       One endpoint for the whole feature, so a screen load or a save costs a
 *       single function invocation. Every op returns the caller's state and their
 *       current matches.
 *
 *       Identity comes from the VTOP session (the profile VTOP returns), never
 *       from the body. Class ids are validated on the server against the
 *       semester's registration report, or read from VTOP itself for
 *       `source: "registered"`. Matches are computed on the server, and a caller
 *       only sees them while they are discoverable themselves.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cookies, authorizedID, csrf, semesterId]
 *             properties:
 *               cookies: { type: string }
 *               authorizedID: { type: string }
 *               csrf: { type: string }
 *               semesterId:
 *                 type: string
 *                 description: VTOP semester id, e.g. CH20262705
 *               op:
 *                 type: string
 *                 enum: [get, publish, visibility, leave]
 *                 default: get
 *               source:
 *                 type: string
 *                 enum: [registered]
 *                 description: publish accepts only registered timetables
 *               classIds:
 *                 type: array
 *                 items: { type: string }
 *                 description: retired; planned publishing is disabled
 *               discoverable:
 *                 type: boolean
 *                 description: visibility (required) and publish (default true)
 *     responses:
 *       200: { description: Caller state and matches (overlaps include regNo) }
 *       400: { description: Missing credentials, unsupported semester, or planned sharing attempted }
 *       401: { description: VTOP session expired }
 *       404: { description: visibility on a semester the caller has not joined }
 *       422: { description: No registered classes found in VTOP for this semester }
 *       429: { description: Rate limited, or the daily change limit is reached }
 *       502: { description: VTOP or the registration report is unreachable }
 *       503: { description: Database unavailable }
 */
import { NextResponse } from "next/server";
import { URLSearchParams } from "url";
import VTOPClient, { getVtopReferer } from "@/lib/clients/VTOPClient";
import { identifyCaller, readBody, type CallerIdentity } from "@/lib/socialCaller";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { ensureSchema as ensureSocialSchema, upsertPerson } from "@/lib/socialDb";
import { parseTimetable } from "@/lib/socialTimetable";
import { getReport, isSupportedSemester, ReportUnavailableError, type FfcsReport } from "@/lib/ffcsReport";
import {
  computeMatches,
  MAX_CHANGES_PER_DAY,
  MAX_REGISTERED_CLASSES,
  normaliseClassIds,
  type MatchSource,
} from "@/lib/ffcsMatch";
import {
  countParticipants,
  deleteEntry,
  ensureFfcsMatchSchema,
  findCandidates,
  getClassRosters,
  getEntry,
  publishEntry,
  backfillRegisterNo,
  registerStudentClasses,
  setClassRegistrationsDiscoverable,
  setDiscoverable,
  syncClassesFromReport,
  unregisterStudentClasses,
  type FfcsMatchEntry,
} from "@/lib/ffcsMatchDb";

type Op = "get" | "publish" | "visibility" | "leave" | "classes";
const OPS: readonly Op[] = ["get", "publish", "visibility", "leave", "classes"];

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

/**
 * The caller's registered class ids for a semester, read from VTOP.
 *
 * `parseTimetable` is the structured path. If it refuses the page (it fails
 * a whole parse on one slot outside its vocabulary, which is right for busy
 * maps but irrelevant here), fall back to the class ids the page contains:
 * the timetable page lists only this student's own registrations.
 */
async function registeredClassIds(caller: CallerIdentity, semesterId: string): Promise<string[]> {
  const res = await VTOPClient().post(
    "/vtop/processViewTimeTable",
    new URLSearchParams({
      authorizedID: caller.authorizedID,
      semesterSubId: semesterId,
      _csrf: caller.csrf,
      x: Date.now().toString(),
    }).toString(),
    {
      headers: {
        Cookie: caller.cookies,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: getVtopReferer(),
      },
    }
  );
  const html = String(res.data ?? "");
  let ids: string[];
  try {
    ids = parseTimetable(html, semesterId).courses.map((c) => c.classId);
  } catch {
    ids = html.match(/CH\d{13}/g) ?? [];
  }
  return normaliseClassIds(ids.filter((id) => id.startsWith(semesterId)));
}

async function buildState(
  caller: CallerIdentity,
  handle: string,
  semesterId: string,
  report: FfcsReport,
  entry: FfcsMatchEntry | null
) {
  const joined = Boolean(entry);
  const visible = Boolean(entry?.discoverable);
  // Reciprocity: matches are only shown while the caller can be found too.
  const [candidates, participants] = await Promise.all([
    visible ? findCandidates(caller.ownerKey, semesterId, entry!.classIds) : Promise.resolve([]),
    countParticipants(semesterId),
  ]);
  const matches = visible
    ? computeMatches(entry!.classIds, candidates, report.offerings)
    : { sections: [], overlaps: [] };

  const windowExpired =
    !entry || Date.now() - new Date(entry.windowStartedAt).getTime() >= 24 * 60 * 60 * 1000;

  return {
    success: true,
    semesterId,
    participants,
    me: {
      handle,
      name: caller.displayName,
      joined,
      discoverable: visible,
      source: entry?.source ?? null,
      classIds: entry?.classIds ?? [],
      updatedAt: entry?.updatedAt ?? null,
      changesLeft: windowExpired
        ? MAX_CHANGES_PER_DAY
        : Math.max(0, MAX_CHANGES_PER_DAY - entry!.changesInWindow),
    },
    ...matches,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const semesterId = (url.searchParams.get("semesterId") ?? "").trim().toUpperCase();
  if (!isSupportedSemester(semesterId)) {
    return fail(400, "semester_not_supported", { detail: "No registration report for this semester" });
  }

  const classIdsParam = url.searchParams.get("classIds");
  const classIds = classIdsParam
    ? normaliseClassIds(classIdsParam.split(",").map((s) => s.trim()).filter(Boolean))
    : [];

  try {
    const [report] = await Promise.all([getReport(semesterId), ensureSocialSchema(), ensureFfcsMatchSchema()]);
    await syncClassesFromReport(semesterId, report.offerings);
    const classes = await getClassRosters(semesterId, classIds);
    return NextResponse.json({ success: true, semesterId, classes });
  } catch (err: unknown) {
    if (err instanceof ReportUnavailableError) return fail(502, "report_unavailable", { detail: err.message });
    const message = err instanceof Error ? err.message : String(err);
    if (/DATABASE_URL|ECONNREFUSED|connect/i.test(message)) {
      return fail(503, "database_unavailable", { detail: "The friend finder needs the database" });
    }
    console.error("ffcs-match GET error:", message);
    return fail(500, "internal_error");
  }
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`ffcs-match:${ip}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  const body = await readBody(req);
  const op = (body.op ?? "get") as Op;
  if (!OPS.includes(op)) return fail(400, "invalid_op", { detail: `op must be one of ${OPS.join(", ")}` });

  const semesterId = typeof body.semesterId === "string" ? body.semesterId.trim().toUpperCase() : "";
  if (!isSupportedSemester(semesterId)) {
    return fail(400, "semester_not_supported", { detail: "No registration report for this semester" });
  }

  if (op === "classes") {
    try {
      const [report] = await Promise.all([getReport(semesterId), ensureSocialSchema(), ensureFfcsMatchSchema()]);
      await syncClassesFromReport(semesterId, report.offerings);
      const classIds = Array.isArray(body.classIds)
        ? normaliseClassIds(body.classIds.map(String))
        : [];
      const classes = await getClassRosters(semesterId, classIds);
      return NextResponse.json({ success: true, semesterId, classes });
    } catch (err: unknown) {
      if (err instanceof ReportUnavailableError) return fail(502, "report_unavailable", { detail: err.message });
      const message = err instanceof Error ? err.message : String(err);
      if (/DATABASE_URL|ECONNREFUSED|connect/i.test(message)) {
        return fail(503, "database_unavailable", { detail: "The friend finder needs the database" });
      }
      console.error("ffcs-match classes error:", message);
      return fail(500, "internal_error");
    }
  }

  const who = await identifyCaller(body as Parameters<typeof identifyCaller>[0]);
  if (!who.ok) return fail(who.status, who.error, who.detail);
  const caller = who.caller;

  try {
    const [report] = await Promise.all([getReport(semesterId), ensureSocialSchema(), ensureFfcsMatchSchema()]);
    await syncClassesFromReport(semesterId, report.offerings);

    // Refreshes the display name from VTOP on every call, so a name is always
    // the one VTOP holds for this student, and mints the public handle.
    const { handle } = await upsertPerson(caller.ownerKey, caller.displayName, caller.regNo);
    if (caller.regNo || caller.displayName) {
      await backfillRegisterNo(caller.ownerKey, semesterId, caller.regNo, caller.displayName, handle);
    }

    if (op === "leave") {
      await Promise.all([
        deleteEntry(caller.ownerKey, semesterId),
        unregisterStudentClasses(semesterId, caller.regNo, caller.ownerKey),
      ]);
      return NextResponse.json(await buildState(caller, handle, semesterId, report, null));
    }

    if (op === "visibility") {
      if (typeof body.discoverable !== "boolean") {
        return fail(400, "invalid_visibility", { detail: "discoverable must be a boolean" });
      }
      const entry = await setDiscoverable(caller.ownerKey, semesterId, body.discoverable);
      if (!entry) return fail(404, "not_joined", { detail: "Publish your classes first" });
      await setClassRegistrationsDiscoverable(semesterId, caller.regNo, caller.ownerKey, body.discoverable);
      return NextResponse.json(await buildState(caller, handle, semesterId, report, entry));
    }

    if (op === "publish") {
      const source = body.source as MatchSource;
      if (source !== "registered") {
        return fail(400, "planned_sharing_disabled", {
          detail: "Only VTOP-verified timetables can be shared",
        });
      }

      const classIds = (await registeredClassIds(caller, semesterId)).slice(0, MAX_REGISTERED_CLASSES);
      if (!classIds.length) {
        return fail(422, "no_registered_classes", {
          detail: "VTOP shows no registered classes for this semester yet",
        });
      }

      const discoverable = typeof body.discoverable === "boolean" ? body.discoverable : true;
      const entry = await publishEntry(
        caller.ownerKey,
        semesterId,
        classIds,
        source,
        discoverable,
        caller.regNo,
        caller.displayName
      );
      if (!entry) {
        return fail(429, "change_limit", {
          detail: `You can change your classes ${MAX_CHANGES_PER_DAY} times a day. Try again tomorrow.`,
        });
      }
      await registerStudentClasses(
        semesterId,
        classIds,
        caller.regNo,
        caller.displayName,
        handle,
        caller.ownerKey,
        discoverable
      );
      return NextResponse.json(await buildState(caller, handle, semesterId, report, entry));
    }

    const entry = await getEntry(caller.ownerKey, semesterId);
    return NextResponse.json(await buildState(caller, handle, semesterId, report, entry));
  } catch (err: unknown) {
    if (err instanceof ReportUnavailableError) return fail(502, "report_unavailable", { detail: err.message });
    const message = err instanceof Error ? err.message : String(err);
    if (/DATABASE_URL|ECONNREFUSED|connect/i.test(message)) {
      return fail(503, "database_unavailable", { detail: "The friend finder needs the database" });
    }
    console.error("ffcs-match error:", message);
    return fail(500, "internal_error");
  }
}
