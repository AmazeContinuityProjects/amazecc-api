import { NextResponse } from "next/server";

const hits = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const timestamps = (hits.get(key) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: windowMs - (now - oldest),
    };
  }

  timestamps.push(now);
  hits.set(key, timestamps);

  return {
    allowed: true,
    remaining: maxRequests - timestamps.length,
    retryAfterMs: windowMs,
  };
}

export function rateLimitResponse(retryAfterMs: number): NextResponse {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return NextResponse.json(
    { success: false, error: "Too many requests. Try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": "0",
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

/**
 * Client IP for rate limiting. The FIRST X-Forwarded-For entry is whatever the
 * client sent, so trusting it let anyone dodge every limit by rotating a fake
 * header.
 *  - TRUSTED_IP_HEADER (env) names a header your edge sets itself, e.g.
 *    "cf-connecting-ip" behind Cloudflare. Used first when set.
 *  - On Vercel, x-vercel-forwarded-for / x-real-ip are set by the platform.
 *  - Otherwise use the LAST X-Forwarded-For entry: the one appended by the
 *    proxy directly in front of us, not by the client.
 */
export function getClientIp(req: Request): string {
  const h = req.headers;
  const trusted = process.env.TRUSTED_IP_HEADER;
  if (trusted) {
    const v = h.get(trusted)?.split(",")[0]?.trim();
    if (v) return v;
  }
  if (process.env.VERCEL) {
    const v = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
    if (v) return v;
  }
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits) {
      const valid = timestamps.filter((t) => now - t < 600000);
      if (valid.length === 0) hits.delete(key);
      else hits.set(key, valid);
    }
  }, 300000);
}
