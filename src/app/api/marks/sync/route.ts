import { NextResponse } from "next/server";
import { URLSearchParams } from "url";
import VTOPClient, { getVtopReferer } from "@/lib/clients/VTOPClient";
import { parseStudentProfile } from "@/lib/parsers/student-profile";
import { getClientIp, checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { getDbPool, getDbErrorStatus, getDbErrorMessage } from "@/lib/db";
import {
  ensureSchema,
  ownerKeyFor,
  recordContribution,
  type Contribution,
  type ContributionOutcome,
} from "@/lib/marksStats";

/**
 * @openapi
 * /api/marks/sync:
 *   post:
 *     tags:
 *       - Marks
 *     summary: Contribute this student's marks to their cohorts' running statistics
 *     description: >
 *       The client forwards its VTOP session and its own current marks. The server
 *       resolves the caller's identity from the VTOP *response* — never from the body —
 *       so a caller cannot write as anybody else, and hashes the owner and every
 *       assessment key itself.
 *
 *       No individual mark is ever stored. To let a student revise a contribution
 *       without the server keeping their value, the client states what it last
 *       contributed and the server checks that claim against an HMAC it minted last
 *       time. A mismatch is declined rather than applied, which makes a replayed or
 *       forged request a no-op.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cookies, authorizedID, csrf, contributions]
 *             properties:
 *               cookies:
 *                 type: string
 *                 description: VTOP session cookie(s). An array is also accepted.
 *               authorizedID:
 *                 type: string
 *               csrf:
 *                 type: string
 *               contributions:
 *                 type: array
 *                 description: >
 *                   One entry per assessment plus one `overall` entry per course.
 *                   `prevMark` is what the client believes it last contributed; omit it
 *                   when the client has no record.
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Contributions recorded
 *       400:
 *         description: Missing credentials or malformed payload
 *       401:
 *         description: VTOP session expired, or identity could not be resolved
 *       429:
 *         description: Rate limited
 *       503:
 *         description: Database unavailable
 */

const VTOP_FORM_HEADERS = (cookieHeader: string) => ({
  Cookie: cookieHeader,
  "Content-Type": "application/x-www-form-urlencoded",
  Referer: getVtopReferer(),
});

/** Bounds one request's work; a term's worth of assessments is well under this. */
const MAX_CONTRIBUTIONS = 400;

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

type WireContribution = {
  classId?: unknown;
  scope?: unknown;
  title?: unknown;
  component?: unknown;
  mark?: unknown;
  prevMark?: unknown;
};

/**
 * Narrow one untrusted entry to the shape `recordContribution` accepts.
 *
 * `classId` must be a non-empty string because it reaches a SQL parameter — a number or
 * an object would be coerced by the driver into something the caller did not intend.
 */
function sanitise(raw: WireContribution): Contribution | null {
  if (!raw || typeof raw !== "object") return null;

  const classId = typeof raw.classId === "string" ? raw.classId.trim() : "";
  if (!classId) return null;

  const mark = Number(raw.mark);
  if (!Number.isFinite(mark)) return null;

  const scope = raw.scope === "overall" ? "overall" : "assessment";
  const title = typeof raw.title === "string" ? raw.title : "";
  const component = typeof raw.component === "string" ? raw.component : "";

  const prevMark =
    raw.prevMark == null ? null : Number(raw.prevMark);

  return {
    classId,
    scope,
    title,
    component,
    mark,
    prevMark: prevMark != null && Number.isFinite(prevMark) ? prevMark : null,
  };
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  // Every request costs one VTOP round trip for the identity check, so this is tighter
  // than a plain read — the same reasoning `social/identity/sync` uses.
  const rl = checkRateLimit(`marks-sync:${ip}`, 20, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  const body = (await req.json().catch(() => ({}))) as {
    cookies?: string | string[];
    authorizedID?: string;
    csrf?: string;
    contributions?: WireContribution[];
  };

  const cookieHeader = Array.isArray(body.cookies)
    ? body.cookies.join("; ")
    : body.cookies;

  if (!cookieHeader || !body.authorizedID || !body.csrf) {
    return fail(400, "missing_credentials", {
      detail: "Missing cookies, csrf or authorizedID",
    });
  }

  const raw = body.contributions;
  if (!Array.isArray(raw) || raw.length === 0) {
    return fail(400, "no_contributions", {
      detail: "contributions must be a non-empty array",
    });
  }
  if (raw.length > MAX_CONTRIBUTIONS) {
    return fail(400, "too_many_contributions", {
      detail: `At most ${MAX_CONTRIBUTIONS} contributions per request`,
      received: raw.length,
    });
  }

  const contributions = raw
    .map(sanitise)
    .filter((c): c is Contribution => c !== null);

  if (contributions.length === 0) {
    return fail(400, "no_valid_contributions", {
      detail: "Every contribution was missing a classId or a numeric mark",
    });
  }

  const client = VTOPClient();

  try {
    // ── identity, from the VTOP response ───────────────────────────────────
    // The same trust boundary `social/identity/sync` uses. Valid cookies return this
    // session's own profile; forged or expired ones return no REGISTER NO and we 401.
    // Nothing in the body can name a different student.
    const profileRes = await client.post(
      "/vtop/studentsRecord/StudentProfileAllView",
      new URLSearchParams({
        verifyMenu: "true",
        authorizedID: body.authorizedID,
        _csrf: body.csrf,
        nocache: Date.now().toString(),
      }).toString(),
      { headers: VTOP_FORM_HEADERS(cookieHeader) }
    );

    const profile = parseStudentProfile(profileRes.data);
    const regNumber = profile.registerNo || profile.applicationNumber;
    if (!regNumber) {
      return fail(401, "vtop_identity_unresolved", {
        detail:
          "VTOP returned no REGISTER NO for these cookies. The session is not this student's, or has expired.",
      });
    }

    const ownerKey = ownerKeyFor(regNumber);

    // ── record ─────────────────────────────────────────────────────────────
    await ensureSchema();

    const pool = getDbPool();
    const db = await pool.connect();
    const tally: Record<ContributionOutcome, number> = {
      added: 0,
      replaced: 0,
      reconciled: 0,
      skipped: 0,
      rejected: 0,
    };

    try {
      await db.query("BEGIN");
      const now = Date.now();
      // `authorizedID` travels only as far as the legacy-reconciliation probe: it lets
      // the server check whether this student contributed under the old scheme, and is
      // never stored or trusted for identity (that came from VTOP above).
      const reconcile = { authorizedID: body.authorizedID, regNo: regNumber };
      for (const c of contributions) {
        const outcome = await recordContribution(db, ownerKey, c, now, reconcile);
        tally[outcome] += 1;
      }
      await db.query("COMMIT");
    } catch (err: unknown) {
      await db.query("ROLLBACK").catch(() => {});
      console.error("marks/sync transaction failed:", err);
      return fail(getDbErrorStatus(err), "stats_write_failed", {
        detail: getDbErrorMessage(err),
      });
    } finally {
      db.release();
    }

    return NextResponse.json({ success: true, tally });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // A VTOP session problem is an expected, recoverable state and the client needs to
    // tell it apart from a genuine server fault, so it gets a 401.
    if (/\b401\b|unauthor|\bsession\b|invalid\s*csrf/i.test(message)) {
      return fail(401, "vtop_session_expired", { detail: message });
    }
    console.error("marks/sync error:", message);
    return fail(502, "vtop_unavailable", { detail: message });
  }
}