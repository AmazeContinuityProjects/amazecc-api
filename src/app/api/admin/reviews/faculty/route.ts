import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

function normalizeFacultyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, "")
    .replace(/[^a-z0-9]/g, "");
}

export async function GET(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || "";
  const school = url.searchParams.get("school") || "";
  const status = url.searchParams.get("status") || "";

  try {
    const pool = getDbPool();
    let query = "SELECT * FROM faculty WHERE 1=1";
    const params: any[] = [];

    if (search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(name) LIKE $${params.length} OR employee_id LIKE $${params.length})`;
    }

    if (school.trim()) {
      params.push(school.trim().toUpperCase());
      query += ` AND school = $${params.length}`;
    }

    if (status.trim()) {
      params.push(status.trim());
      query += ` AND status = $${params.length}`;
    }

    query += " ORDER BY name ASC LIMIT 100";
    const { rows } = await pool.query(query, params);

    return NextResponse.json({ success: true, faculty: rows });
  } catch (err) {
    console.error("[admin/reviews/faculty GET] Error:", err);
    return NextResponse.json({ error: "Failed to list faculty" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { name, employee_id, school, designation, image_url, vitfac_id } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Faculty name is required" }, { status: 400 });
    }

    const cleanName = name.trim();
    const nameNorm = normalizeFacultyName(cleanName);
    const cleanEmpId = employee_id ? String(employee_id).trim() : null;
    const cleanSchool = school ? String(school).trim().toUpperCase() : null;
    const cleanDesignation = designation ? String(designation).trim() : null;
    const cleanImageUrl = image_url ? String(image_url).trim() : null;
    const cleanVitfacId = vitfac_id ? String(vitfac_id).trim() : null;

    const pool = getDbPool();
    const insertSql = `
      INSERT INTO faculty (
        employee_id, name, name_norm, school, designation, image_url, vitfac_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'official')
      RETURNING *;
    `;

    const { rows } = await pool.query(insertSql, [
      cleanEmpId,
      cleanName,
      nameNorm,
      cleanSchool,
      cleanDesignation,
      cleanImageUrl,
      cleanVitfacId,
    ]);

    const created = rows[0];

    await logAdminAction({
      admin_user: auth.username,
      action: "Create Faculty",
      target_resource: `/api/admin/reviews/faculty/${created.id}`,
      details: { faculty_id: created.id, name: cleanName, employee_id: cleanEmpId, school: cleanSchool },
    });

    return NextResponse.json({ success: true, faculty: created }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json({ error: "A faculty member with this employee ID already exists" }, { status: 409 });
    }
    console.error("[admin/reviews/faculty POST] Error:", err);
    return NextResponse.json({ error: "Failed to create faculty member" }, { status: 500 });
  }
}
