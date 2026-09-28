/**
 * @openapi
 * /api/social/identity/sync:
 *   post:
 *     tags:
 *       - Social
 *     summary: Derive and store the caller's identity and current-semester timetable
 *     description: >
 *       The client forwards its VTOP session; the server does all the deriving.
 *       The owner's identity comes from the VTOP *response*, never from the
 *       request body, so a caller cannot name someone else's row. This is the
 *       only write path for timetable data.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cookies, authorizedID, csrf]
 *             properties:
 *               cookies:
 *                 type: string
 *                 description: VTOP session cookie(s). An array is also accepted.
 *               authorizedID:
 *                 type: string
 *               csrf:
 *                 type: string
 *               proposedSemesterId:
 *                 type: string
 *                 description: >
 *                   Validated against VTOP's scraped semester list. Ignored if
 *                   not offered; never trusted as-is.
 *     responses:
 *       200:
 *         description: Timetable derived and stored
 *       400:
 *         description: Missing credentials, or a busy map outside the vocabulary
 *       401:
 *         description: VTOP session expired or identity could not be resolved
 *       422:
 *         description: proposedSemesterId is not in VTOP's list
 *       429:
 *         description: Rate limited
 *       502:
 *         description: VTOP unreachable, or the semester list could not be parsed
 */

import { NextResponse } from "next/server";
import { URLSearchParams } from "url";
import VTOPClient, { getVtopReferer } from "@/lib/clients/VTOPClient";
import { parseStudentProfile } from "@/lib/parsers/student-profile";
import { getClientIp, checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { SLOTMAP_VERSION } from "@/lib/socialVocabulary";
import { parseTimetable, UnknownSlotError } from "@/lib/socialTimetable";
import {
  parseSemesterOptions,
  resolveSemester,
  SemesterListUnavailableError,
  SemesterNotOfferedError,
  SEMESTER_PAGES,
} from "@/lib/socialSemester";
import {
  cacheCurrentSemester,
  ensureSchema,
  ownerKeyFor,
  upsertPerson,
  upsertTimetable,
} from "@/lib/socialDb";
import { listGrantsFor, otherParticipant, secretForParticipant } from "@/lib/socialGrants";
import { getDbPool } from "@/lib/db";

/** One VTOP round trip per derivation. */
const VTOP_FORM_HEADERS = (cookieHeader: string, referer = getVtopReferer()) => ({
  Cookie: cookieHeader,
  "Content-Type": "application/x-www-form-urlencoded",
  Referer: referer,
});

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

/**
 * Peers and the caller's own grant secrets, for the landing page.
 *
 * The secrets are decrypted here because BOTH partners need one: the claimer
 * receives the plaintext at claim time, and the other partner has no other way
 * to obtain it. This is the only path that hands out secrets, and it only ever
 * does so for grants the authenticated caller is a participant of.
 */
async function buildPeerView(
  ownerKey: string,
  semesterId: string
): Promise<{ peers: unknown[]; grantSecrets: unknown[] }> {
  const grants = await listGrantsFor(ownerKey);
  const peers: unknown[] = [];
  const grantSecrets: unknown[] = [];
  const pool = getDbPool();

  for (const grant of grants) {
    if (grant.revokedAt) continue;
    const peerKey = otherParticipant(grant, ownerKey);
    const secret = await secretForParticipant(grant, ownerKey);

    const { rows } = await pool.query(
      `SELECT p.handle, p.display_name,
              (SELECT published_at FROM social_timetables
                WHERE owner_key = $1 AND semester_id = $2) AS published_at
         FROM social_people p
        WHERE p.owner_key = $1`,
      [peerKey, semesterId]
    );
    const peer = rows[0];

    peers.push({
      handle: peer?.handle ?? null,
      name: peer?.display_name ?? "",
      visibility: grant.visibility,
      shared: true,
      lastPublishedAt: peer?.published_at ?? null,
      semesterId: peer?.published_at ? semesterId : null,
      isSelf: false,
    });

    if (secret) {
      grantSecrets.push({
        grantId: grant.grantId,
        secret,
        peerHandle: peer?.handle ?? null,
        visibility: grant.visibility,
        createdAt: grant.createdAt,
      });
    }
  }

  return { peers, grantSecrets };
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  // This is the only amplification path in the API: one client request becomes
  // 3-4 VTOP requests, so the limit is tighter than a typical read.
  const rl = checkRateLimit(`social-sync:${ip}`, 20, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  const { cookies, authorizedID, csrf, proposedSemesterId } = (await req
    .json()
    .catch(() => ({}))) as {
    cookies?: string | string[];
    authorizedID?: string;
    csrf?: string;
    proposedSemesterId?: string;
  };

  const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
  if (!csrf || !authorizedID || !cookieHeader) {
    return fail(400, "missing_credentials", {
      detail: "Missing cookies, csrf or authorizedID",
    });
  }

  const client = VTOPClient();
  const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

  try {
    // ── 1. identity, from the VTOP RESPONSE ──────────────────────────
    // Nothing in the request body is trusted here. Valid cookies return this
    // session's own profile; forged or expired ones return a page with no
    // REGISTER NO row, and we 401.
    const profileRes = await client.post(
      "/vtop/studentsRecord/StudentProfileAllView",
      form({ verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString() }),
      { headers: VTOP_FORM_HEADERS(cookieHeader) }
    );

    const profile = parseStudentProfile(profileRes.data);
    // Mirrors AmazeCC-API/src/lib/identity.ts:175
    const regNumber = profile.registerNo || profile.applicationNumber;
    if (!regNumber) {
      return fail(401, "vtop_identity_unresolved", {
        detail:
          "VTOP returned no REGISTER NO for these cookies. The session is not this student's, or has expired.",
      });
    }

    const ownerKey = ownerKeyFor(regNumber);
    const displayName = profile.name || "";

    // ── 2. semester list ─────────────────────────────────────────────
    // The `selected` option is always the empty placeholder, so the current
    // semester cannot be read from the dropdown; it is proposed and validated.
    let options: ReturnType<typeof parseSemesterOptions> = [];
    let semesterListFailed = false;
    for (const path of SEMESTER_PAGES) {
      const res = await client.post(
        path,
        form({ verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString() }),
        {
          headers: VTOP_FORM_HEADERS(
            cookieHeader,
            `${process.env.VTOP_BASE_URL || "https://vtopcc.vit.ac.in"}${path}`
          ),
        }
      );
      options = parseSemesterOptions(res.data);
      if (options.length) break;
      semesterListFailed = true;
    }
    if (!options.length) {
      return fail(502, "semester_list_unavailable", {
        detail: `Could not parse #semesterSubId from ${SEMESTER_PAGES.join(" or ")}`,
        tried: SEMESTER_PAGES,
        ...(semesterListFailed ? {} : {}),
      });
    }

    let resolution;
    try {
      resolution = resolveSemester(options, proposedSemesterId);
    } catch (err: unknown) {
      if (err instanceof SemesterNotOfferedError) {
        return fail(422, "semester_not_offered", {
          detail: err.message,
          proposed: err.proposed,
          optionCount: err.optionCount,
        });
      }
      if (err instanceof SemesterListUnavailableError) {
        return fail(502, "semester_list_unavailable", { detail: err.message });
      }
      throw err;
    }

    // ── 3. timetable ─────────────────────────────────────────────────
    const ttRes = await client.post(
      "/vtop/processViewTimeTable",
      form({
        authorizedID,
        semesterSubId: resolution.semesterId,
        _csrf: csrf,
        x: Date.now().toString(),
      }),
      { headers: VTOP_FORM_HEADERS(cookieHeader) }
    );

    let parsed;
    try {
      parsed = parseTimetable(ttRes.data, resolution.semesterId);
    } catch (err: unknown) {
      if (err instanceof UnknownSlotError) {
        // A partially-accepted map would look complete and be wrong, so the
        // whole publish fails.
        return fail(400, "unknown_slot", {
          detail: err.message,
          invalidKeys: err.invalidKeys.slice(0, 20),
          slotmapVersion: SLOTMAP_VERSION,
        });
      }
      return fail(502, "timetable_parse_failed", {
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    // Class ids embed the semester code, so a mismatch proves the resolved
    // semester was wrong. Discard rather than store.
    if (parsed.semesterMismatch) {
      return fail(422, "semester_mismatch", {
        detail:
          "VTOP returned class ids that do not belong to the resolved semester. Discarded rather than stored.",
        resolved: resolution.semesterId,
        classIdSamples: parsed.classIdSamples.slice(0, 3),
      });
    }

    // ── 4. persist ───────────────────────────────────────────────────
    await ensureSchema();
    const person = await upsertPerson(ownerKey, displayName);
    const stored = await upsertTimetable(
      ownerKey,
      resolution.semesterId,
      parsed.busyMap,
      parsed.courses,
      SLOTMAP_VERSION
    );
    await cacheCurrentSemester({
      semesterId: resolution.semesterId,
      label: resolution.semesterLabel,
    });

    // Peers and grant secrets come from the pairing layer. A failure here must
    // not discard a timetable we just derived, so it degrades to empty rather
    // than failing the whole sync.
    let peers: unknown[] = [];
    let grantSecrets: unknown[] = [];
    try {
      const fromGrants = await buildPeerView(ownerKey, resolution.semesterId);
      peers = fromGrants.peers;
      grantSecrets = fromGrants.grantSecrets;
    } catch (grantErr: unknown) {
      console.error(
        "social/identity/sync peer view failed:",
        grantErr instanceof Error ? grantErr.message : String(grantErr)
      );
    }

    return NextResponse.json({
      success: true,
      identity: {
        ownerKey,
        handle: person.handle,
        displayName,
        semesterId: resolution.semesterId,
        semesterLabel: resolution.semesterLabel,
        derivedAt: stored.publishedAt,
        slotmapVersion: SLOTMAP_VERSION,
      },
      semesterSource: resolution.source,
      version: stored.version,
      busyMap: parsed.busyMap,
      courses: parsed.courses,
      peers,
      grantSecrets,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // VTOP session problems are an expected, recoverable state, so they get a
    // 401 rather than the 500 this API's other credential-forwarding routes
    // return. The client needs to tell them apart to prompt a re-login.
    if (/\b401\b|unauthor|\bsession\b|invalid\s*csrf/i.test(message)) {
      return fail(401, "vtop_session_expired", { detail: message });
    }
    console.error("social/identity/sync error:", message);
    return fail(502, "vtop_unavailable", { detail: message });
  }
}
