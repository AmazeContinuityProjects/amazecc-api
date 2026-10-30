import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { extractAuthorizedID, getStudentReviewHash } from "@/lib/reviews/reviewAuth";
import { REVIEWS_CONFIG } from "@/config/reviewQuestions";
import { getSemesterReviewStatus } from "@/lib/reviews/semesterTiming";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-authorized-id",
    },
  });
}

export async function GET(req: Request) {
  const authorizedID = extractAuthorizedID(req);
  if (!authorizedID) {
    return NextResponse.json({ error: "Unauthorized: Missing authorizedID" }, { status: 401 });
  }

  try {
    const studentHash = getStudentReviewHash(authorizedID);
    const pool = getDbPool();

    // 1. Fetch verified enrollments for this student
    const enrollmentsQuery = `
      SELECT 
        e.semester, e.course_code, e.component, e.source,
        f.id as faculty_id, f.name as faculty_name, f.school, f.employee_id, f.image_url
      FROM enrollments e
      JOIN faculty f ON e.faculty_id = f.id
      WHERE e.student_hash = $1 AND f.status != 'hidden'
      ORDER BY e.semester DESC, e.course_code ASC;
    `;
    const enrollmentsRes = await pool.query(enrollmentsQuery, [studentHash]);

    // 2. Fetch existing reviews submitted by this student
    const reviewsQuery = `
      SELECT 
        r.id, r.faculty_id, r.track, r.course_code, r.semester, r.project_term,
        r.verified, r.created_at, r.updated_at,
        f.name as faculty_name
      FROM reviews r
      JOIN faculty f ON r.faculty_id = f.id
      WHERE r.student_hash = $1
      ORDER BY r.created_at DESC;
    `;
    const reviewsRes = await pool.query(reviewsQuery, [studentHash]);

    const editWindowMs = REVIEWS_CONFIG.limits.editWindowDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Map existing reviews for quick lookup
    const reviewMap = new Map<string, any>();
    for (const rev of reviewsRes.rows) {
      const key = `${rev.track}:${rev.faculty_id}:${rev.course_code || ""}:${rev.semester || ""}:${rev.project_term || ""}`;
      const ageMs = now - new Date(rev.created_at).getTime();
      const canEdit = ageMs < editWindowMs;
      reviewMap.set(key, {
        id: rev.id,
        created_at: rev.created_at,
        can_edit: canEdit,
        days_left_to_edit: canEdit ? Math.max(0, Math.ceil((editWindowMs - ageMs) / (24 * 60 * 60 * 1000))) : 0,
      });
    }

    // Process teaching eligibility
    const teachingEligible = enrollmentsRes.rows.map((enr) => {
      const key = `teaching:${enr.faculty_id}:${enr.course_code}:${enr.semester}:`;
      const existing = reviewMap.get(key) || null;
      return {
        faculty: {
          id: enr.faculty_id,
          name: enr.faculty_name,
          school: enr.school,
          employee_id: enr.employee_id,
          image_url: enr.image_url,
        },
        course_code: enr.course_code,
        semester: enr.semester,
        component: enr.component || "Theory",
        source: enr.source,
        reviewed: existing !== null,
        review_details: existing,
        timing: getSemesterReviewStatus(enr.semester),
      };
    });

    // Process project guide eligibility
    const projectReviews = reviewsRes.rows.filter((r) => r.track === "project");
    const maxProjectReviews = REVIEWS_CONFIG.limits.maxProjectReviewsPerYear;
    const projectEligible = {
      can_review: projectReviews.length < maxProjectReviews,
      total_allowed: maxProjectReviews,
      remaining_slots: Math.max(0, maxProjectReviews - projectReviews.length),
      existing_reviews: projectReviews.map((r) => {
        const key = `project:${r.faculty_id}:::${r.project_term || ""}`;
        return {
          id: r.id,
          faculty_id: r.faculty_id,
          faculty_name: r.faculty_name,
          project_term: r.project_term,
          created_at: r.created_at,
          details: reviewMap.get(key),
        };
      }),
    };

    return NextResponse.json(
      {
        authorized: true,
        teaching: teachingEligible,
        project: projectEligible,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  } catch (err) {
    console.error("[reviews/eligibility] Error:", err);
    return NextResponse.json({ error: "Failed to fetch review eligibility" }, { status: 500 });
  }
}
