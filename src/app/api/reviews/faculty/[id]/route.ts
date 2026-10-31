import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { isReviewsEnabled, reviewsDisabledResponse } from "@/lib/reviews/featureFlag";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isReviewsEnabled()) return reviewsDisabledResponse();

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing faculty ID" }, { status: 400 });
  }

  const workerBase = process.env.REVIEWS_WORKER_URL || "http://localhost:8787";
  const ifNoneMatch = req.headers.get("if-none-match");

  // 1. Try reading from Cloudflare Worker edge cache
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const workerRes = await fetch(`${workerBase}/api/reviews/faculty/${encodeURIComponent(id)}`, {
      headers: ifNoneMatch ? { "if-none-match": ifNoneMatch } : {},
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (workerRes.status === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: workerRes.headers.get("ETag") || "",
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
        },
      });
    }

    if (workerRes.ok) {
      const data = await workerRes.json();
      return NextResponse.json(data, {
        headers: {
          ETag: workerRes.headers.get("ETag") || "",
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
        },
      });
    }
  } catch (err) {
    console.warn(`[reviews/faculty/${id}] Worker unreachable, falling back to Degraded Mode:`, (err instanceof Error ? err.message : String(err)));
  }

  // 2. Degraded Mode: Query Postgres
  try {
    const pool = getDbPool();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const facultyQuery = isUuid
      ? "SELECT id, employee_id, name, school, designation, image_url, status FROM faculty WHERE id = $1 AND status != 'hidden'"
      : "SELECT id, employee_id, name, school, designation, image_url, status FROM faculty WHERE (employee_id = $1 OR id::text = $1) AND status != 'hidden'";
    const facultyRes = await pool.query(facultyQuery, [id]);

    if (facultyRes.rows.length === 0) {
      return NextResponse.json({ error: "Faculty not found" }, { status: 404 });
    }

    const faculty = facultyRes.rows[0];
    const aggRes = await pool.query(
      "SELECT track, course_code, n_reviews, n_verified, grade, per_question, style, tag_counts FROM faculty_aggregates WHERE faculty_id = $1",
      [faculty.id]
    );

    let teachingGlobal: any = null;
    let projectGlobal: any = null;
    const teaching_by_course: Record<string, any> = {};

    for (const r of aggRes.rows) {
      const trackItem = {
        track: r.track,
        course_code: r.course_code,
        n_reviews: parseInt(r.n_reviews, 10),
        n_verified: parseInt(r.n_verified, 10),
        grade: r.grade ? parseFloat(r.grade) : null,
        is_early: parseInt(r.n_reviews, 10) >= 3 && parseInt(r.n_reviews, 10) <= 7,
        per_question: r.per_question || {},
        style: r.style || {},
        top_tags_green: r.tag_counts?.green || [],
        top_tags_red: r.tag_counts?.red || [],
      };

      if (r.track === "teaching") {
        if (r.course_code === "") {
          teachingGlobal = trackItem;
        } else {
          teaching_by_course[r.course_code.toUpperCase()] = trackItem;
        }
      } else if (r.track === "project" && r.course_code === "") {
        projectGlobal = trackItem;
      }
    }

    return NextResponse.json({
      schemaVersion: "1.0.0",
      faculty,
      teaching: teachingGlobal,
      project: projectGlobal,
      teaching_by_course,
      degraded_mode: true,
      updated_at: new Date().toISOString(),
    });
  } catch (dbErr) {
    console.error(`[reviews/faculty/${id}] Database error:`, dbErr);
    return NextResponse.json({ error: "Failed to load faculty profile" }, { status: 500 });
  }
}
