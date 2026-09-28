/**
 * @openapi
 * /api/social/timetable:
 *   post:
 *     tags: [Social]
 *     summary: Read a paired student's timetable
 *     description: >
 *       Access is authorised by the presented grant secret, NOT by naming a
 *       target. There is no regNumber parameter anywhere in this contract —
 *       that omission is the point. A valid secret authorises reading only the
 *       people named in that grant, so a leaked secret exposes one specific peer
 *       to one specific person, never the whole graph.
 *     responses:
 *       200: { description: Timetable returned, filtered by the grant's visibility }
 *       400: { description: Missing credentials, secret or handle }
 *       403: { description: grant_invalid, or the caller is not a participant of the target's grant }
 *       404: { description: Handle not found, or nothing published for that semester }
 */

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { identifyCaller, readBody } from "@/lib/socialCaller";
import { getTimetable } from "@/lib/socialDb";
import { findGrantBySecret, findOwnerKeyByHandle, isParticipant } from "@/lib/socialGrants";
import { STALE_AFTER_DAYS, toCoarse, type BusyMap } from "@/lib/socialTypes";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  // A peer list of 200 with a naive client would otherwise be 200 reads per
  // render.
  const rl = checkRateLimit(`social-read:${ip}`, 120, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  const body = await readBody(req);
  const ident = await identifyCaller(
    body as { cookies?: string; authorizedID?: string; csrf?: string }
  );
  if (!ident.ok) {
    return NextResponse.json(
      { success: false, error: ident.error, ...(ident.detail ?? {}) },
      { status: ident.status }
    );
  }
  const { caller } = ident;

  const secret = String(body.secret ?? "");
  const handle = String(body.handle ?? "")
    .trim()
    .toUpperCase();
  if (!secret || !handle) {
    return NextResponse.json(
      { success: false, error: "missing_grant", detail: "Missing secret or handle" },
      { status: 400 }
    );
  }

  // ── authorisation ────────────────────────────────────────────────────
  // Two checks, deliberately ANDed. The secret alone is the credential, and the
  // session alone is not enough — so a leaked secret is still useless to
  // anyone who is not one of the two paired students. The first check is what
  // keeps a stolen secret from exposing the graph.
  const grant = await findGrantBySecret(secret);
  if (!grant) {
    return NextResponse.json(
      { success: false, error: "grant_invalid", detail: "Unknown, revoked or expired grant" },
      { status: 403 }
    );
  }

  // Same status and same error for "you are not in this grant" and "they are
  // not in this grant", so a caller holding a foreign secret cannot use the
  // response to probe who is paired with whom.
  if (!isParticipant(grant, caller.ownerKey)) {
    return NextResponse.json(
      {
        success: false,
        error: "not_a_participant",
        detail: "This grant does not cover you and the requested student together",
      },
      { status: 403 }
    );
  }

  const peer = await findOwnerKeyByHandle(handle);
  if (!peer) {
    return NextResponse.json({ success: false, error: "handle_not_found" }, { status: 404 });
  }

  if (!isParticipant(grant, peer.ownerKey)) {
    return NextResponse.json(
      { success: false, error: "not_a_participant", detail: "Not covered by this grant" },
      { status: 403 }
    );
  }

  // ── which semester ───────────────────────────────────────────────────
  const pool = getDbPool();
  let semesterId = String(body.semester ?? "").trim();
  let semesterLabel = String(body.semesterLabel ?? "");

  if (!semesterId) {
    // Default to the campus-wide current term. Cross-cohort pairs differ, so
    // the response always states which term it actually returned.
    const cached = await pool.query(
      "SELECT value FROM app_config WHERE key = 'social_current_semester'"
    );
    semesterId = (cached.rows[0]?.value?.semesterId as string) ?? "";
    semesterLabel = (cached.rows[0]?.value?.label as string) ?? "";
  }

  if (!semesterId) {
    return NextResponse.json({ success: false, error: "no_current_semester" }, { status: 404 });
  }

  const stored = await getTimetable(peer.ownerKey, semesterId);
  if (!stored) {
    return NextResponse.json(
      {
        success: false,
        error: "no_timetable_for_semester",
        detail: `${peer.displayName || "This student"} has not published ${semesterId}`,
      },
      { status: 404 }
    );
  }

  // ── visibility ───────────────────────────────────────────────────────
  // A grant is ONE row shared by both directions, so its `visibility` IS the
  // effective setting — either partner can change it, and the change applies
  // both ways. There is no separate reverse value to reconcile.
  const visibility = grant.visibility;
  const busyMap: BusyMap = visibility === "coarse" ? toCoarse(stored.busyMap) : stored.busyMap;

  // A stale record is not neutral information: someone who dropped a class still
  // reads as busy until they sync.
  const stale =
    Date.now() - new Date(stored.publishedAt).getTime() > STALE_AFTER_DAYS * 86_400_000;

  return NextResponse.json({
    success: true,
    identity: {
      // Deliberately NOT owner_key. The client keys peers by handle, so the
      // internal pseudonym buys it nothing and would just be one more stable
      // identifier to correlate.
      handle,
      displayName: peer.displayName || "",
      semesterId: stored.semesterId,
      semesterLabel,
      publishedAt: stored.publishedAt,
      slotmapVersion: stored.slotmapVersion,
    },
    visibility,
    stale,
    version: stored.version,
    busyMap,
    courses: visibility === "full" ? stored.courses : [],
  });
}
