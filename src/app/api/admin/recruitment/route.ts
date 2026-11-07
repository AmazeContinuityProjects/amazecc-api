/**
 * @openapi
 * /api/admin/recruitment:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List recruitment applications
 *     description: Requires an admin token with the `recruitment` permission (superadmins always pass).
 *     parameters:
 *       - { in: query, name: role, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string, enum: [new, shortlisted, accepted, rejected] } }
 *       - { in: query, name: cycle, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer, maximum: 200 } }
 *       - { in: query, name: offset, schema: { type: integer } }
 *     responses:
 *       200: { description: Applications, newest first }
 *       401: { description: Unauthorized }
 *       403: { description: Missing the recruitment permission }
 *   patch:
 *     tags:
 *       - Admin
 *     summary: Set an application's status
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, status]
 *             properties:
 *               id: { type: integer }
 *               status: { type: string, enum: [new, shortlisted, accepted, rejected] }
 *               note: { type: string }
 *     responses:
 *       200: { description: Updated application }
 *       404: { description: No such application }
 */
import { NextResponse } from "next/server";
import { hasAdminPermission, requireAdminAuth } from "@/lib/auth";
import { APPLICATION_STATUSES, RECRUITMENT, type ApplicationStatus } from "@/lib/recruitment";
import { ensureRecruitmentSchema, listApplications, setApplicationStatus } from "@/lib/recruitmentDb";

const PERMISSION = "recruitment";

async function authorise(req: Request) {
  const admin = await requireAdminAuth(req);
  if (admin instanceof NextResponse) return admin;
  if (!hasAdminPermission(admin, PERMISSION)) {
    return NextResponse.json({ success: false, message: "Missing the recruitment permission" }, { status: 403 });
  }
  return admin;
}

function isStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (APPLICATION_STATUSES as readonly string[]).includes(value);
}

export async function GET(req: Request) {
  const admin = await authorise(req);
  if (admin instanceof NextResponse) return admin;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  if (status && !isStatus(status)) {
    return NextResponse.json({ success: false, error: "invalid_status" }, { status: 400 });
  }
  await ensureRecruitmentSchema();
  const result = await listApplications({
    cycle: url.searchParams.get("cycle") || RECRUITMENT.cycle,
    role: url.searchParams.get("role") || undefined,
    status: (status as ApplicationStatus) || undefined,
    limit: Number(url.searchParams.get("limit")) || undefined,
    offset: Number(url.searchParams.get("offset")) || undefined,
  });
  return NextResponse.json({ success: true, ...result });
}

export async function PATCH(req: Request) {
  const admin = await authorise(req);
  if (admin instanceof NextResponse) return admin;

  const body = (await req.json().catch(() => ({}))) as { id?: unknown; status?: unknown; note?: unknown };
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1 || !isStatus(body.status)) {
    return NextResponse.json({ success: false, error: "invalid_request" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) || null : null;

  await ensureRecruitmentSchema();
  const updated = await setApplicationStatus(id, body.status, admin.username, note);
  if (!updated) return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ success: true, application: updated });
}
