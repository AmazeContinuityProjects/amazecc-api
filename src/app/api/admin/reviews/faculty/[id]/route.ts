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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing faculty ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { name, employee_id, school, designation, image_url, status, merged_into } = body;

    const pool = getDbPool();

    // Check faculty exists
    const checkRes = await pool.query("SELECT * FROM faculty WHERE id = $1", [id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: "Faculty not found" }, { status: 404 });
    }
    const current = checkRes.rows[0];

    // Handle merge action
    if (status === "merged" && merged_into) {
      if (merged_into === id) {
        return NextResponse.json({ error: "Cannot merge faculty into themselves" }, { status: 400 });
      }
      // Re-point enrollments and reviews to target faculty
      await pool.query("UPDATE enrollments SET faculty_id = $1 WHERE faculty_id = $2", [merged_into, id]);
      await pool.query("UPDATE reviews SET faculty_id = $1 WHERE faculty_id = $2", [merged_into, id]);
      await pool.query(
        "UPDATE faculty SET status = 'merged', merged_into = $1, updated_at = NOW() WHERE id = $2",
        [merged_into, id]
      );

      await logAdminAction({
        admin_user: auth.username,
        action: "Merge Faculty",
        target_resource: `/api/admin/reviews/faculty/${id}`,
        details: { from_id: id, merged_into },
      });

      return NextResponse.json({ success: true, message: "Faculty merged successfully" });
    }

    const newName = name ? String(name).trim() : current.name;
    const newNameNorm = name ? normalizeFacultyName(newName) : current.name_norm;
    const newEmpId = employee_id !== undefined ? (employee_id ? String(employee_id).trim() : null) : current.employee_id;
    const newSchool = school !== undefined ? (school ? String(school).trim().toUpperCase() : null) : current.school;
    const newDesignation = designation !== undefined ? (designation ? String(designation).trim() : null) : current.designation;
    const newImageUrl = image_url !== undefined ? (image_url ? String(image_url).trim() : null) : current.image_url;
    const newStatus = status && ["official", "merged", "hidden"].includes(status) ? status : current.status;

    const updateSql = `
      UPDATE faculty SET
        name = $1,
        name_norm = $2,
        employee_id = $3,
        school = $4,
        designation = $5,
        image_url = $6,
        status = $7,
        updated_at = NOW()
      WHERE id = $8
      RETURNING *;
    `;

    const { rows } = await pool.query(updateSql, [
      newName,
      newNameNorm,
      newEmpId,
      newSchool,
      newDesignation,
      newImageUrl,
      newStatus,
      id,
    ]);

    await logAdminAction({
      admin_user: auth.username,
      action: "Update Faculty",
      target_resource: `/api/admin/reviews/faculty/${id}`,
      details: { faculty_id: id, updates: body },
    });

    return NextResponse.json({ success: true, faculty: rows[0] });
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json({ error: "A faculty member with this employee ID already exists" }, { status: 409 });
    }
    console.error(`[admin/reviews/faculty/${id} PATCH] Error:`, err);
    return NextResponse.json({ error: "Failed to update faculty member" }, { status: 500 });
  }
}
