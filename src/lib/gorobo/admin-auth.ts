import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";

export type GoroboAuth = { username: string; role: "superadmin" | "admin"; permissions: string[] };

/**
 * Admin auth for the GoRoBo back-office. Requires a valid admin token that
 * carries the `gorobo` permission. Superadmins are granted it at login.
 */
export async function requireGoroboAdmin(
  req: Promise<Request> | Request
): Promise<GoroboAuth | NextResponse> {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.permissions.includes("gorobo")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return auth;
}
