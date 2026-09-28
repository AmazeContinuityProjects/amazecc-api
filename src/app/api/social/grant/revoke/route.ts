/**
 * @openapi
 * /api/social/grant/revoke:
 *   post:
 *     tags: [Social]
 *     summary: End a pairing
 *     description: >
 *       One grant row covers both directions, so a single revoke severs both.
 *       POST rather than GET on purpose — a revocation that could be triggered
 *       by a prefetch or a link preview is not a revocation. Idempotent.
 *     responses:
 *       200: { description: Revoked, or already revoked }
 *       403: { description: Caller is not a participant }
 *       404: { description: Grant not found }
 */

import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { identifyCaller, readBody } from "@/lib/socialCaller";
import { getGrantById, isParticipant, revokeGrant } from "@/lib/socialGrants";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`social-grant:${ip}`, 60, 60_000);
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

  const grantId = String(body.grantId ?? "").trim();
  const secret = String(body.secret ?? "");
  if (!grantId || !secret) {
    return NextResponse.json(
      { success: false, error: "missing_grant_reference" },
      { status: 400 }
    );
  }

  const grant = await getGrantById(grantId);
  if (!grant) {
    return NextResponse.json({ success: false, error: "grant_not_found" }, { status: 404 });
  }
  // Either partner may end it.
  if (!isParticipant(grant, caller.ownerKey)) {
    return NextResponse.json(
      { success: false, error: "not_a_participant" },
      { status: 403 }
    );
  }

  await revokeGrant(grantId);
  return NextResponse.json({ success: true, grantId, revoked: true });
}
