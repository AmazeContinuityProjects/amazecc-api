import { NextResponse } from "next/server";

/**
 * Master switch for the Faculty Reviews feature. Strict opt-in: only the
 * literal string "true" enables it; unset or any other value means OFF, so
 * merging and deploying this code cannot change production behaviour.
 */
export function isReviewsEnabled(): boolean {
  return process.env.ENABLE_AMAZE_REVIEWS === "true";
}

export function reviewsDisabledResponse(): NextResponse {
  return NextResponse.json(
    { error: "Faculty reviews are not enabled" },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
