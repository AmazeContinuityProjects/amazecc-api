/**
 * @openapi
 * /api/social/grant/visibility:
 *   post:
 *     tags: [Social]
 *     summary: Change what a pairing can see
 *     description: >
 *       `coarse` returns slot occupancy only; `full` adds course, code and
 *       venue. Either partner may set it, and because a grant is one shared row
 *       the change applies both ways — neither partner can unilaterally hide from
 *       the other, which is what keeps a mutual pairing coherent.
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Missing reference, or an unknown visibility }
 *       403: { description: Caller is not a participant }
 *       404: { description: Grant not found }
 */

import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { identifyCaller, readBody } from "@/lib/socialCaller";
import { getGrantById, isParticipant, setVisibility } from "@/lib/socialGrants";
import type { SocialVisibility } from "@/lib/socialTypes";

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
  const visibility = String(body.visibility ?? "") as SocialVisibility;
  if (!grantId) {
    return NextResponse.json({ success: false, error: "missing_grant_reference" }, { status: 400 });
  }
  if (visibility !== "coarse" && visibility !== "full") {
    return NextResponse.json(
      { success: false, error: "invalid_visibility", detail: "Expected coarse or full" },
      { status: 400 }
    );
  }

  const grant = await getGrantById(grantId);
  if (!grant) {
    return NextResponse.json({ success: false, error: "grant_not_found" }, { status: 404 });
  }
  if (!isParticipant(grant, caller.ownerKey)) {
    return NextResponse.json({ success: false, error: "not_a_participant" }, { status: 403 });
  }

  await setVisibility(grantId, visibility);
  return NextResponse.json({ success: true, grantId, visibility });
}
