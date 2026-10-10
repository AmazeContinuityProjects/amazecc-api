import { NextResponse } from "next/server";
import { URLSearchParams } from "url";
import VTOPClient from "@/lib/clients/VTOPClient";
import { parseStudentProfile } from "@/lib/parsers/student-profile";
import { getClientIp, checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { getDbErrorStatus, getDbErrorMessage } from "@/lib/db";
import {
  ensureSchema,
  enrolledSubset,
  ownerKeyFor,
  statsForClasses,
} from "@/lib/marksStats";

/**
 * @openapi
 * /api/marks/stats:
 *   post:
 *     tags:
 *       - Marks
 *     summary: Cohort statistics for classes the caller is enrolled in
 *     description: >
 *       The caller names the classes it wants to display; each id is checked against
 *       the enrollment recorded when `/api/attendance` scraped this student's own
 *       marks. Anything not enrolled is dropped, so the parameter cannot be used to
 *       enumerate a cohort the caller does not belong to — which is what the old
 *       `?classes=a,b,c` query parameter allowed anyone to do.
 *
 *       Requires POST because the client's request layer only attaches VTOP credentials
 *       to a POST carrying a body; a GET would arrive anonymous.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cookies, authorizedID, csrf, classIds]
 *             properties:
 *               cookies:
 *                 type: string
 *               authorizedID:
 *                 type: string
 *               csrf:
 *                 type: string
 *               classIds:
 *                 type: array
 *                 description: >
 *                   Class ids to resolve. Verified against enrollment, never trusted.
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Statistics keyed by class id
 *       400:
 *         description: Missing credentials
 *       401:
 *         description: VTOP session expired, or marks could not be read
 *       429:
 *         description: Rate limited
 *       503:
 *         description: Database unavailable
 */

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`marks-stats:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  const { cookies, authorizedID, csrf, classIds } = (await req
    .json()
    .catch(() => ({}))) as {
    cookies?: string | string[];
    authorizedID?: string;
    csrf?: string;
    classIds?: string[];
  };

  const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
  if (!cookieHeader || !authorizedID || !csrf) {
    return fail(400, "missing_credentials", {
      detail: "Missing cookies, csrf or authorizedID",
    });
  }

  const client = VTOPClient();

  try {
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return fail(400, "no_classes", {
        detail: "classIds must be a non-empty array",
      });
    }
    if (classIds.length > 100) {
      return fail(400, "too_many_classes", {
        detail: "At most 100 classes per request",
      });
    }
    const requested = classIds.filter(
      (id): id is string => typeof id === "string" && id.length > 0 && id.length <= 64
    );
    if (requested.length === 0) {
      return fail(400, "no_valid_classes", { detail: "No usable class ids" });
    }

    // Identity from the VTOP response, never the body — a caller cannot name someone
    // else's enrollment.
    const identityRes = await client.post(
      "/vtop/studentsRecord/StudentProfileAllView",
      new URLSearchParams({
        verifyMenu: "true",
        authorizedID,
        _csrf: csrf,
        nocache: Date.now().toString(),
      }).toString(),
      {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const profile = parseStudentProfile(identityRes.data);
    const regNumber = profile.registerNo || profile.applicationNumber;
    if (!regNumber) {
      return fail(401, "vtop_identity_unresolved", {
        detail:
          "VTOP returned no REGISTER NO for these cookies. The session is not this student's, or has expired.",
      });
    }

    await ensureSchema();

    // The caller names the classes it wants to display; the enrollment table decides
    // which of those it may actually have. Anything else is silently dropped rather
    // than refused, so a stale id degrades to "no data" instead of an error.
    const allowed = await enrolledSubset(ownerKeyFor(regNumber), requested);
    const stats = await statsForClasses(allowed);

    const withData = Object.values(stats).filter(
      (s) => s && (s.count ?? 0) > 0
    ).length;
    console.log(
      `marks/stats: requested ${requested.length}, enrolled ${allowed.length}, ` +
        `${withData} with data`
    );

    return NextResponse.json({ success: true, stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/\b401\b|unauthor|\bsession\b|invalid\s*csrf/i.test(message)) {
      return fail(401, "vtop_session_expired", { detail: message });
    }
    // A missing table is a first-run condition, not a fault; report it as such so the
    // client renders an empty cohort rather than an error.
    if (/relation "[^"]+" does not exist/i.test(message)) {
      return NextResponse.json({ success: true, stats: {} });
    }
    console.error("marks/stats error:", message);
    return fail(getDbErrorStatus(err), "stats_read_failed", {
      detail: getDbErrorMessage(err),
    });
  }
}

/** Kept so a stale client that still GETs gets a pointed error rather than a 405. */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "method_not_allowed",
      detail:
        "This endpoint requires POST with the caller's VTOP session so that credentials are attached and the class set cannot be chosen by the caller.",
    },
    { status: 405, headers: { Allow: "POST" } }
  );
}