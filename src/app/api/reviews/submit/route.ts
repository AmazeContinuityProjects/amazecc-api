import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { extractAuthorizedID, getStudentReviewHash, signIngestPayload } from "@/lib/reviews/reviewAuth";
import { validateReviewSubmission } from "@/lib/reviews/validation";
import { REVIEWS_CONFIG } from "@/config/reviewQuestions";
import { getSemesterReviewStatus } from "@/lib/reviews/semesterTiming";

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
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const authorizedID = extractAuthorizedID(req, body);
  if (!authorizedID) {
    return NextResponse.json({ error: "Unauthorized: Missing authorizedID" }, { status: 401 });
  }

  // 1. Rate Limiting per student
  const rateLimitKey = `reviews_submit:${authorizedID}`;
  const rateLimit = checkRateLimit(rateLimitKey, 10, 5 * 60 * 1000); // 10 submits per 5 minutes
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterMs);
  }

  // 2. Strict Input Validation (STRICTLY NO FREE-TEXT)
  const validation = validateReviewSubmission(body);
  if (!validation.valid || !validation.sanitized) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const {
    faculty_id,
    track,
    course_code,
    semester,
    project_term,
    answers,
    tags_green,
    tags_red,
    context,
    grade_bucket,
  } = validation.sanitized;

  try {
    const studentHash = getStudentReviewHash(authorizedID);
    const pool = getDbPool();

    // 3. Verify Faculty Exists
    const facultyRes = await pool.query(
      "SELECT id, status FROM faculty WHERE id = $1",
      [faculty_id]
    );
    if (facultyRes.rows.length === 0 || facultyRes.rows[0].status === "hidden") {
      return NextResponse.json({ error: "Faculty member not found or inactive" }, { status: 404 });
    }

    // 4. Server-Side Eligibility Verification
    let verified = false;

    if (track === "teaching") {
      // Check enrollment snapshot
      const enrRes = await pool.query(
        "SELECT 1 FROM enrollments WHERE student_hash = $1 AND faculty_id = $2 AND course_code = $3 AND semester = $4",
        [studentHash, faculty_id, course_code, semester]
      );

      if (enrRes.rows.length > 0) {
        verified = true;

        // Constraint: Reviews can only be submitted 1 month before semester end
        if (semester) {
          const timingStatus = getSemesterReviewStatus(semester);
          if (!timingStatus.isOpen) {
            return NextResponse.json(
              { error: `Reviews for ${timingStatus.label} are not open yet. ${timingStatus.reason}` },
              { status: 403 }
            );
          }
        }
      } else {
        return NextResponse.json(
          { error: "Eligibility check failed: You can only review faculty members you have studied under in a verified course enrollment." },
          { status: 403 }
        );
      }
    } else {
      // Project Guide track: check annual limit (max 3 per academic year)
      const projectCountRes = await pool.query(
        "SELECT COUNT(*) as count FROM reviews WHERE student_hash = $1 AND track = 'project'",
        [studentHash]
      );
      const projectCount = parseInt(projectCountRes.rows[0].count, 10);
      if (projectCount >= REVIEWS_CONFIG.limits.maxProjectReviewsPerYear) {
        return NextResponse.json(
          { error: `Project Guide review limit reached (maximum ${REVIEWS_CONFIG.limits.maxProjectReviewsPerYear} per year)` },
          { status: 403 }
        );
      }
      verified = Boolean(context.verified_context);
    }

    // 5. Check Edit Window for Existing Review
    const existingRes = await pool.query(
      `SELECT id, created_at FROM reviews 
       WHERE student_hash = $1 AND faculty_id = $2 AND track = $3 
         AND COALESCE(course_code, '') = COALESCE($4, '') 
         AND COALESCE(semester, '') = COALESCE($5, '') 
         AND COALESCE(project_term, '') = COALESCE($6, '')`,
      [studentHash, faculty_id, track, course_code || "", semester || "", project_term || ""]
    );

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      const ageMs = Date.now() - new Date(existing.created_at).getTime();
      const editWindowMs = REVIEWS_CONFIG.limits.editWindowDays * 24 * 60 * 60 * 1000;
      if (ageMs > editWindowMs) {
        return NextResponse.json(
          { error: `Review editing locked: the ${REVIEWS_CONFIG.limits.editWindowDays}-day editing window has closed.` },
          { status: 403 }
        );
      }
    }

    // 6. Direct Upsert to Postgres
    const upsertSql = `
      INSERT INTO reviews (
        student_hash, faculty_id, track, course_code, semester, project_term,
        verified, answers, tags_green, tags_red, context, grade_bucket, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (student_hash, faculty_id, track, COALESCE(course_code, ''), COALESCE(semester, ''), COALESCE(project_term, ''))
      DO UPDATE SET
        answers = EXCLUDED.answers,
        tags_green = EXCLUDED.tags_green,
        tags_red = EXCLUDED.tags_red,
        context = EXCLUDED.context,
        grade_bucket = EXCLUDED.grade_bucket,
        updated_at = NOW();
    `;

    await pool.query(upsertSql, [
      studentHash,
      faculty_id,
      track,
      course_code,
      semester,
      project_term,
      verified,
      JSON.stringify(answers),
      tags_green,
      tags_red,
      JSON.stringify(context),
      grade_bucket,
    ]);

    // 7. Write Buffering: Forward to Cloudflare Worker Ingest & Trigger Recompute
    const idempotencyKey = `${studentHash}:${faculty_id}:${track}:${course_code || ""}:${semester || ""}:${project_term || ""}`;
    const messagePayload = {
      schemaVersion: "1.0.0",
      idempotencyKey,
      student_hash: studentHash,
      faculty_id,
      track,
      course_code,
      semester,
      project_term,
      verified,
      answers,
      tags_green,
      tags_red,
      context,
      grade_bucket,
      timestamp: Date.now(),
    };

    const workerBase = process.env.REVIEWS_WORKER_URL || "http://localhost:8787";
    const rawPayload = JSON.stringify(messagePayload);

    try {
      const { timestamp, signature } = signIngestPayload(rawPayload);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      await fetch(`${workerBase}/internal/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature": signature,
          "x-timestamp": timestamp,
        },
        body: rawPayload,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
    } catch (workerErr) {
      console.warn("[reviews/submit] Worker ingest warning:", workerErr);
    }

    try {
      const { timestamp, signature } = signIngestPayload("");
      const recomputeUrl = `${workerBase}/internal/recompute`;
      await fetch(recomputeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature": signature,
          "x-timestamp": timestamp,
        },
        body: "",
      }).catch((e) => console.warn("[submit] Recompute call warning:", e));
    } catch {}

    return NextResponse.json(
      {
        success: true,
        status: "recorded",
        idempotencyKey,
        verified,
        message: "Review recorded successfully.",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[reviews/submit] Execution error:", err);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
