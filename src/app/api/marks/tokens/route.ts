import { NextResponse } from "next/server";
import { URLSearchParams } from "url";
import VTOPClient from "@/lib/clients/VTOPClient";
import { parseStudentProfile } from "@/lib/parsers/student-profile";
import { getClientIp, checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { getDbErrorStatus, getDbErrorMessage } from "@/lib/db";
import {
  ensureSchema,
  legacyAssociations,
  ownerKeyFor,
  tokensForOwner,
} from "@/lib/marksStats";

/**
 * @openapi
 * /api/marks/tokens:
 *   post:
 *     tags:
 *       - Marks
 *     summary: The HMACs the server currently holds for this student
 *     description: >
 *       The client sends its VTOP session and nothing else. The server verifies
 *       identity against VTOP, then returns every token it holds for that student plus
 *       any old-scheme classes plausibly theirs — presence and continuity, never values.
 *       An HMAC is non-invertible by construction, so this response cannot hand back a
 *       mark nobody retained; what it lets the client do is (a) check that accepted
 *       writes landed as minted, and (b) see exactly which contributions it can no
 *       longer update, instead of discovering that as silence.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cookies, authorizedID, csrf]
 *     responses:
 *       200:
 *         description: Tokens and legacy associations
 *       400:
 *         description: Missing credentials
 *       401:
 *         description: VTOP session expired, or identity could not be resolved
 *       429:
 *         description: Rate limited
 */

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`marks-tokens:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  const { cookies, authorizedID, csrf } = (await req
    .json()
    .catch(() => ({}))) as {
    cookies?: string | string[];
    authorizedID?: string;
    csrf?: string;
  };

  const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
  if (!cookieHeader || !authorizedID || !csrf) {
    return fail(400, "missing_credentials", {
      detail: "Missing cookies, csrf or authorizedID",
    });
  }

  const client = VTOPClient();

  try {
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
    const ownerKey = ownerKeyFor(regNumber);
    const [tokens, legacy] = await Promise.all([
      tokensForOwner(ownerKey),
      legacyAssociations(authorizedID, regNumber),
    ]);

    return NextResponse.json({ success: true, tokens, legacy });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/\b401\b|unauthor|\bsession\b|invalid\s*csrf/i.test(message)) {
      return fail(401, "vtop_session_expired", { detail: message });
    }
    if (/relation "[^"]+" does not exist/i.test(message)) {
      return NextResponse.json({ success: true, tokens: [], legacy: [] });
    }
    console.error("marks/tokens error:", message);
    return fail(getDbErrorStatus(err), "tokens_read_failed", {
      detail: getDbErrorMessage(err),
    });
  }
}
