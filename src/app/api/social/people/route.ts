/**
 * @openapi
 * /api/social/people:
 *   post:
 *     tags: [Social]
 *     summary: Look up a student by public handle
 *     description: >
 *       Handle-to-person resolution for the pairing flow. Search is exact-match
 *       on the handle only — there is no query-by-name endpoint, because a
 *       name search turns a public handle system into a student directory.
 *       Response is rate limited and omits owner_key so handles cannot be
 *       correlated with reg numbers through this route.
 *     responses:
 *       200: { description: Found }
 *       400: { description: Missing credentials or handle }
 *       404: { description: No student with that handle }
 *       429: { description: Rate limited }
 */

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { identifyCaller, readBody } from "@/lib/socialCaller";
import { ensureGrantsSchema } from "@/lib/socialGrants";
import { ensureSchema } from "@/lib/socialDb";

const HANDLE_RE = /^AMZ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  // Tight: this is a directory-enumeration surface, so 20/min.
  const rl = checkRateLimit(`social-people:${ip}`, 20, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  const body = await readBody(req);
  // Even a lookup needs a live session, so an unauthenticated caller cannot
  // walk handles at all.
  const ident = await identifyCaller(
    body as { cookies?: string; authorizedID?: string; csrf?: string }
  );
  if (!ident.ok) {
    return NextResponse.json(
      { success: false, error: ident.error, ...(ident.detail ?? {}) },
      { status: ident.status }
    );
  }

  const handle = String(body.handle ?? "")
    .trim()
    .toUpperCase();
  if (!HANDLE_RE.test(handle)) {
    return NextResponse.json(
      { success: false, error: "invalid_handle_format", detail: "Expected AMZ-XXXX-XXXX" },
      { status: 400 }
    );
  }

  // Both tables are read below, and either may not exist yet on a fresh deploy.
  // The grant count is a nicety, so a grants-table problem must not fail the
  // lookup itself.
  await ensureSchema();
  try {
    await ensureGrantsSchema();
  } catch (err: unknown) {
    console.error("social/people could not ensure grants schema:", err instanceof Error ? err.message : String(err));
  }

  const pool = getDbPool();
  const { rows } = await pool.query(
    `SELECT p.handle, p.display_name,
            (SELECT COUNT(*) FROM social_grants g
              WHERE (g.owner_a = p.owner_key OR g.owner_b = p.owner_key)
                AND g.revoked_at IS NULL) AS grant_count
       FROM social_people p
      WHERE p.handle = $1`,
    [handle]
  );
  if (!rows.length) {
    return NextResponse.json({ success: false, error: "handle_not_found" }, { status: 404 });
  }

  const row = rows[0];
  return NextResponse.json({
    success: true,
    person: {
      handle: row.handle,
      displayName: row.display_name || "",
      // Lets the UI say "already paired" without a second round trip, but leaks
      // nothing about who — only whether this person is pairable.
      alreadyPaired: Number(row.grant_count) > 0,
    },
  });
}
