/**
 * @openapi
 * /api/recruitment:
 *   get:
 *     tags:
 *       - Recruitment
 *     summary: Recruitment configuration for the join page
 *     description: Whether applications are open, the cycle, deadline, roles and field limits.
 *     responses:
 *       200: { description: Configuration }
 *   post:
 *     tags:
 *       - Recruitment
 *     summary: Submit (or update) an application to join the AmazeCC community
 *     description: >
 *       One application per VIT student email per cycle. Submitting again with
 *       the same email updates the application while it is unreviewed.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, regNo, year, roles, why, hoursPerWeek, consent]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, description: "@vitstudent.ac.in" }
 *               regNo: { type: string, example: 25BCE1234 }
 *               year: { type: integer, minimum: 1, maximum: 5 }
 *               roles: { type: array, items: { type: string } }
 *               otherRole: { type: string, description: Required when roles includes "other" }
 *               why: { type: string }
 *               experience: { type: string }
 *               links: { type: array, items: { type: string } }
 *               hoursPerWeek: { type: integer }
 *               consent: { type: boolean, enum: [true] }
 *     responses:
 *       200: { description: Application stored }
 *       400: { description: Invalid fields (per-field messages in `errors`) }
 *       403: { description: Applications are closed }
 *       409: { description: Already reviewed, or too many edits }
 *       429: { description: Rate limited }
 *       503: { description: Database unavailable }
 */
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { maskIP } from "@/lib/mask";
import { isSpamTrap, publicConfig, RECRUITMENT, validateApplication } from "@/lib/recruitment";
import { ensureRecruitmentSchema, submitApplication } from "@/lib/recruitmentDb";

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

export async function GET() {
  return NextResponse.json(
    { success: true, ...publicConfig() },
    // Config changes only with a deploy; let the CDN hold it briefly.
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } }
  );
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`recruitment:${ip}`, 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  if (!RECRUITMENT.open) {
    return fail(403, "closed", { detail: "Applications are closed right now." });
  }

  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fail(400, "invalid_body", { detail: "Send the application as a JSON object." });
  }
  const body = raw as Record<string, unknown>;

  // Bots fill the hidden field; answer as if it worked and store nothing.
  if (isSpamTrap(body)) return NextResponse.json({ success: true, status: "received" });

  const v = validateApplication(body);
  if (!v.ok) return fail(400, "invalid_fields", { errors: v.errors });

  try {
    await ensureRecruitmentSchema();
    const outcome = await submitApplication(RECRUITMENT.cycle, v.value, maskIP(ip));
    switch (outcome.kind) {
      case "created":
      case "updated":
        return NextResponse.json({ success: true, status: outcome.kind });
      case "locked":
        return fail(409, "already_reviewed", {
          detail: "Your application has already been reviewed, so it can't be changed now.",
        });
      case "too_many_edits":
        return fail(409, "too_many_edits", {
          detail: "You've updated your application the maximum number of times.",
        });
      case "ip_limit":
        return fail(429, "too_many_submissions", { detail: "Too many applications from this network today." });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/DATABASE_URL|ECONNREFUSED|connect/i.test(message)) {
      return fail(503, "database_unavailable", { detail: "Applications are temporarily unavailable." });
    }
    console.error("recruitment submit error:", message);
    return fail(500, "internal_error");
  }
}
