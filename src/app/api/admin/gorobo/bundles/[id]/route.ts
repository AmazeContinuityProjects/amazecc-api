import { NextResponse } from "next/server";
import { getDbPool, getDbErrorStatus, getDbErrorMessage } from "@/lib/db";
import { ensureGoroboSchema, type GoroboBundle } from "@/lib/gorobo/schema";
import { requireGoroboAdmin } from "@/lib/gorobo/admin-auth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, context: RouteContext) {
  const auth = await requireGoroboAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await ensureGoroboSchema();
    const pool = getDbPool();

    const { rows: existing } = await pool.query<GoroboBundle>(
      `SELECT id FROM gorobo_bundles WHERE id = $1`,
      [id]
    );
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: "Bundle not found" }, { status: 404 });
    }

    const name = typeof body?.name === "string" ? body.name.trim() : null;
    const description = typeof body?.description === "string" ? body.description.trim() : null;
    const category = typeof body?.category === "string" ? body.category.trim() : null;
    const items = Array.isArray(body?.items) ? body.items : null;
    const bundlePrice = body?.bundlePrice !== undefined ? Number(body.bundlePrice) : null;
    const discountPct = body?.discountPct !== undefined ? Number(body.discountPct) : null;
    const image = typeof body?.image === "string" ? body.image.trim() : null;
    const isActive = body?.isActive !== undefined ? Boolean(body.isActive) : null;

    const { rows } = await pool.query<GoroboBundle>(
      `UPDATE gorobo_bundles
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           items = COALESCE($4::jsonb, items),
           bundle_price = COALESCE($5, bundle_price),
           discount_pct = COALESCE($6, discount_pct),
           image = COALESCE($7, image),
           is_active = COALESCE($8, is_active),
           updated_at = now()
       WHERE id = $9
       RETURNING id, name, description, category, items, bundle_price, discount_pct, image, is_active, created_at, updated_at`,
      [
        name,
        description,
        category,
        items ? JSON.stringify(items) : null,
        bundlePrice,
        discountPct,
        image,
        isActive,
        id,
      ]
    );

    await logAdminAction({
      admin_user: auth.username,
      action: "Update Project Kit Bundle",
      target_resource: `/api/admin/gorobo/bundles/${id}`,
      details: { id, name: rows[0].name, bundlePrice: rows[0].bundle_price }
    });

    const updated = rows[0];
    return NextResponse.json({
      success: true,
      bundle: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        category: updated.category,
        items: Array.isArray(updated.items) ? updated.items : [],
        bundlePrice: Number(updated.bundle_price),
        discountPct: Number(updated.discount_pct),
        image: updated.image,
        isActive: updated.is_active,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      }
    });
  } catch (error: any) {
    console.error("admin gorobo bundle PUT error:", error.message);
    return NextResponse.json({ success: false, error: getDbErrorMessage(error) }, { status: getDbErrorStatus(error) });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const auth = await requireGoroboAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    await ensureGoroboSchema();
    const pool = getDbPool();

    const { rowCount } = await pool.query(
      `DELETE FROM gorobo_bundles WHERE id = $1`,
      [id]
    );

    if (!rowCount || rowCount === 0) {
      return NextResponse.json({ success: false, error: "Bundle not found" }, { status: 404 });
    }

    await logAdminAction({
      admin_user: auth.username,
      action: "Delete Project Kit Bundle",
      target_resource: `/api/admin/gorobo/bundles/${id}`,
      details: { id }
    });

    return NextResponse.json({ success: true, message: "Bundle deleted successfully" });
  } catch (error: any) {
    console.error("admin gorobo bundle DELETE error:", error.message);
    return NextResponse.json({ success: false, error: getDbErrorMessage(error) }, { status: getDbErrorStatus(error) });
  }
}
