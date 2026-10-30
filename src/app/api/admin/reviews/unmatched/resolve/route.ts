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

export async function POST(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { unmatched_id, action, target_faculty_id, new_faculty } = body;

    if (!unmatched_id) {
      return NextResponse.json({ error: "Missing unmatched_id" }, { status: 400 });
    }

    const pool = getDbPool();
    const unmatchedRes = await pool.query(
      "SELECT * FROM unmatched_faculty WHERE id = $1",
      [unmatched_id]
    );

    if (unmatchedRes.rows.length === 0) {
      return NextResponse.json({ error: "Unmatched faculty record not found" }, { status: 404 });
    }

    const unmatched = unmatchedRes.rows[0];
    let resolvedFacultyId: string | null = null;

    if (action === "link") {
      if (!target_faculty_id) {
        return NextResponse.json({ error: "target_faculty_id is required for link action" }, { status: 400 });
      }
      resolvedFacultyId = target_faculty_id;
    } else if (action === "create") {
      const name = new_faculty?.name || unmatched.raw_name;
      const school = new_faculty?.school || unmatched.raw_school;
      const employee_id = new_faculty?.employee_id || null;
      const designation = new_faculty?.designation || null;

      const insertRes = await pool.query(
        `INSERT INTO faculty (name, name_norm, school, employee_id, designation, status)
         VALUES ($1, $2, $3, $4, $5, 'official')
         RETURNING id`,
        [name, normalizeFacultyName(name), school, employee_id, designation]
      );
      resolvedFacultyId = insertRes.rows[0].id;
    } else if (action === "ignore") {
      await pool.query(
        "UPDATE unmatched_faculty SET status = 'ignored', updated_at = NOW() WHERE id = $1",
        [unmatched_id]
      );
      return NextResponse.json({ success: true, message: "Marked as ignored" });
    } else {
      return NextResponse.json({ error: "Invalid action: must be 'link', 'create', or 'ignore'" }, { status: 400 });
    }

    // Update unmatched status to resolved
    await pool.query(
      "UPDATE unmatched_faculty SET status = 'resolved', updated_at = NOW() WHERE id = $1",
      [unmatched_id]
    );

    await logAdminAction({
      admin_user: auth.username,
      action: "Resolve Unmatched Faculty",
      target_resource: `/api/admin/reviews/unmatched/${unmatched_id}`,
      details: { unmatched_id, action, resolved_to: resolvedFacultyId },
    });

    return NextResponse.json({
      success: true,
      resolved_faculty_id: resolvedFacultyId,
      message: "Unmatched faculty resolved successfully",
    });
  } catch (err) {
    console.error("[admin/reviews/unmatched/resolve] Error:", err);
    return NextResponse.json({ error: "Failed to resolve unmatched faculty" }, { status: 500 });
  }
}
