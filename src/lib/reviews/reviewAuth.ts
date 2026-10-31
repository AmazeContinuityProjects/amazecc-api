import crypto from "crypto";

export function getReviewHashSecret(): string {
  const secret = process.env.REVIEW_HASH_SECRET;
  if (!secret) {
    throw new Error("REVIEW_HASH_SECRET environment variable is required");
  }
  return secret;
}

/**
 * Canonicalizes the authorized ID (trim + uppercase). No person-specific
 * translation table: mapping one student's identifiers onto another real
 * student would contaminate verified reviews.
 */
export function normalizeAuthorizedId(id: string): string {
  return id.trim().toUpperCase();
}

export function getStudentReviewHash(authorizedID: string): string {
  const secret = getReviewHashSecret();
  const cleanId = normalizeAuthorizedId(authorizedID);
  return crypto.createHmac("sha256", secret).update(cleanId).digest("hex");
}

/**
 * Reads the student identity from the request ONLY:
 *   1. `x-authorized-id` header (preferred — never ends up in access logs)
 *   2. `Authorization: Bearer` header
 *   3. JSON body field `authorizedID` (POST payloads)
 * It deliberately does NOT read query strings: URLs (with query params) end up
 * in proxies/CDN/server access logs.
 */
export function extractAuthorizedID(req: Request, body?: { authorizedID?: string }): string | null {
  const fromHeader = req.headers.get("x-authorized-id") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (fromHeader && fromHeader.trim()) {
    return normalizeAuthorizedId(fromHeader);
  }
  if (body?.authorizedID && typeof body.authorizedID === "string" && body.authorizedID.trim()) {
    return normalizeAuthorizedId(body.authorizedID);
  }
  return null;
}

export function signIngestPayload(rawBody: string): { timestamp: string; signature: string } {
  const secret = process.env.REVIEWS_INGEST_SECRET;
  if (!secret) {
    throw new Error("REVIEWS_INGEST_SECRET is not configured");
  }
  const timestamp = Date.now().toString();
  const payload = `${timestamp}.${rawBody}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return { timestamp, signature };
}

export function verifyIngestPayload(rawBody: string, timestamp: string, signature: string): boolean {
  const secret = process.env.REVIEWS_INGEST_SECRET;
  if (!secret || !timestamp || !signature) return false;
  const tsNum = parseInt(timestamp, 10);
  const now = Date.now();
  if (isNaN(tsNum) || Math.abs(now - tsNum) > 5 * 60 * 1000) {
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}

