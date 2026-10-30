import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const workerBase = process.env.REVIEWS_WORKER_URL || "http://localhost:8787";
  const ifNoneMatch = req.headers.get("if-none-match");

  // 1. Try reading from Cloudflare Worker edge cache
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const workerRes = await fetch(`${workerBase}/api/reviews/catalog`, {
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
    console.warn("[reviews/catalog] Cloudflare Worker unreachable, falling back to Degraded Mode (Postgres):", (err instanceof Error ? err.message : String(err)));
  }

  // 2. Degraded Mode: Directly query Postgres if Worker is down
  try {
    const pool = getDbPool();
    const query = `
      SELECT 
        f.id, f.employee_id, f.name, f.name_norm, f.school, f.designation, f.image_url, f.vitfac_id,
        t_agg.grade as teaching_grade, COALESCE(t_agg.n_reviews, 0) as teaching_reviews,
        COALESCE(t_agg.n_verified, 0) as teaching_verified,
        p_agg.grade as project_grade, COALESCE(p_agg.n_reviews, 0) as project_reviews
      FROM faculty f
      LEFT JOIN faculty_aggregates t_agg ON f.id = t_agg.faculty_id AND t_agg.track = 'teaching' AND t_agg.course_code = ''
      LEFT JOIN faculty_aggregates p_agg ON f.id = p_agg.faculty_id AND p_agg.track = 'project' AND p_agg.course_code = ''
      WHERE f.status = 'official'
      ORDER BY f.name ASC;
    `;
    const { rows } = await pool.query(query);

    const faculty = rows.map((r) => {
      const tReviews = parseInt(r.teaching_reviews, 10);
      const tVerified = parseInt(r.teaching_verified, 10);
      return {
        id: r.id,
        employee_id: r.employee_id,
        name: r.name,
        name_norm: r.name_norm,
        school: r.school,
        designation: r.designation,
        image_url: r.image_url,
        vitfac_id: r.vitfac_id,
        teaching_grade: r.teaching_grade ? parseFloat(r.teaching_grade) : null,
        teaching_reviews: tReviews,
        teaching_verified_ratio: tReviews > 0 ? tVerified / tReviews : 0,
        project_grade: r.project_grade ? parseFloat(r.project_grade) : null,
        project_reviews: parseInt(r.project_reviews, 10),
        updated_at: new Date().toISOString(),
      };
    });

    return NextResponse.json({ schemaVersion: "1.0.0", faculty, degraded_mode: true }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (dbErr) {
    console.error("[reviews/catalog] Database error in degraded mode:", dbErr);
    return NextResponse.json({ error: "Failed to load faculty catalog" }, { status: 500 });
  }
}
