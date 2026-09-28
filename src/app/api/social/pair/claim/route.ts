/**
 * @openapi
 * /api/social/pair/claim:
 *   post:
 *     tags: [Social]
 *     summary: Pair with another student by their public handle
 *     description: >
 *       Creates the MUTUAL grant. Both participants end up able to read each
 *       other's timetable, because a grant is one row covering both directions.
 *       Idempotent: re-claiming an existing pair returns the same grantId and
 *       does NOT rotate the secret, since the peer may already have stored it.
 *     responses:
 *       200: { description: Paired, or an existing pairing returned }
 *       400: { description: Missing credentials or a malformed handle }
 *       404: { description: Handle not found }
 *       409: { description: Pairing with yourself, or the grant limit is reached }
 *       429: { description: Rate limited }
 */

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { identifyCaller, readBody } from "@/lib/socialCaller";
import { TIMETABLE_TABLE, getTimetable } from "@/lib/socialDb";
import {
  createOrGetGrant,
  findOwnerKeyByHandle,
  isParticipant,
  listGrantsFor,
} from "@/lib/socialGrants";
import type { SocialVisibility } from "@/lib/socialTypes";

const HANDLE_RE = /^AMZ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const MAX_GRANTS = 200;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  // Bounds handle enumeration.
  const rl = checkRateLimit(`social-pair:${ip}`, 30, 3_600_000);
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

  const handle = String(body.handle ?? "")
    .trim()
    .toUpperCase();
  if (!HANDLE_RE.test(handle)) {
    return NextResponse.json(
      { success: false, error: "invalid_handle_format", detail: "Expected AMZ-XXXX-XXXX" },
      { status: 400 }
    );
  }

  const peer = await findOwnerKeyByHandle(handle);
  if (!peer) {
    // Existence is not disclosed beyond what pairing already grants.
    return NextResponse.json(
      { success: false, error: "handle_not_found", detail: "No student with that handle" },
      { status: 404 }
    );
  }

  if (peer.ownerKey === caller.ownerKey) {
    return NextResponse.json(
      { success: false, error: "already_self", detail: "That is your own handle" },
      { status: 409 }
    );
  }

  const existing = await listGrantsFor(caller.ownerKey);
  if (
    existing.length >= MAX_GRANTS &&
    !existing.some((g) => isParticipant(g, peer.ownerKey))
  ) {
    return NextResponse.json(
      { success: false, error: "grant_limit_reached", detail: `Limit is ${MAX_GRANTS} pairings` },
      { status: 409 }
    );
  }

  const visibility = (body.visibility === "full" ? "full" : "coarse") as SocialVisibility;
  const expiresInMinutes =
    typeof body.expiresInMinutes === "number" && body.expiresInMinutes > 0
      ? Math.min(body.expiresInMinutes, 60 * 24 * 365)
      : undefined;

  const grant = await createOrGetGrant(caller.ownerKey, peer.ownerKey, {
    visibility,
    expiresInMinutes,
  });

  // Which semesters both of them have published, so the client can say
  // "no shared term yet" instead of rendering empty rows.
  const pool = getDbPool();
  const shared = await pool.query(
    `SELECT DISTINCT mine.semester_id
       FROM ${TIMETABLE_TABLE} mine
       JOIN ${TIMETABLE_TABLE} theirs ON mine.semester_id = theirs.semester_id
      WHERE mine.owner_key = $1 AND theirs.owner_key = $2`,
    [caller.ownerKey, peer.ownerKey]
  );

  const cached = await pool.query(
    "SELECT value FROM app_config WHERE key = 'social_current_semester'"
  );
  const currentSemester = (cached.rows[0]?.value?.semesterId as string) ?? "";
  const peerTt = currentSemester ? await getTimetable(peer.ownerKey, currentSemester) : null;

  return NextResponse.json({
    success: true,
    grantId: grant.grantId,
    secret: grant.secret,
    created: grant.created,
    visibility: grant.visibility,
    peer: {
      handle,
      name: peer.displayName || "",
      lastPublishedAt: peerTt?.publishedAt ?? null,
      semesters: (shared.rows as { semester_id: string }[]).map((r) => r.semester_id),
    },
  });
}
