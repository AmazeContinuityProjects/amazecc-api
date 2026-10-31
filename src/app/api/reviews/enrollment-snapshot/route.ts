import { NextResponse } from "next/server";
import { extractAuthorizedID } from "@/lib/reviews/reviewAuth";
import { recordEnrollmentSnapshot } from "@/lib/reviews/recordEnrollments";
import { isReviewsEnabled, reviewsDisabledResponse } from "@/lib/reviews/featureFlag";
import { sanitizeSemester, sanitizeTimetableCourses } from "@/lib/reviews/enrollmentInput";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-authorized-id",
    },
  });
}

export async function POST(req: Request) {
  if (!isReviewsEnabled()) return reviewsDisabledResponse();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const authorizedID = extractAuthorizedID(req, body);
  if (!authorizedID) {
    return NextResponse.json({ error: "Unauthorized: Missing authorizedID" }, { status: 401 });
  }

  const limit = checkRateLimit(`reviews_enrollment:${authorizedID}`, 6, 10 * 60 * 1000);
  if (!limit.allowed) {
    return rateLimitResponse(limit.retryAfterMs);
  }

  const courses = sanitizeTimetableCourses(body?.courses);
  if (courses.length === 0) {
    return NextResponse.json({ success: true, recorded: 0, unmatched: 0 });
  }

  try {
    const { recordedCount, unmatchedCount } = await recordEnrollmentSnapshot(
      authorizedID,
      courses,
      sanitizeSemester(body?.semester, "FALL2026-27")
    );

    return NextResponse.json({
      success: true,
      recorded: recordedCount,
      unmatched: unmatchedCount,
    });
  } catch (err) {
    console.error("[reviews/enrollment-snapshot] Error:", err);
    return NextResponse.json({ error: "Failed to record enrollments" }, { status: 500 });
  }
}
