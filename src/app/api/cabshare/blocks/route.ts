import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { requireCabshareUser } from "@/lib/cabshareAuth";

export async function POST(req: Request) {
    const caller = await requireCabshareUser(req);
    if (caller instanceof NextResponse) return caller;
    try {
        const body = await req.json().catch(() => ({}));
        const { blocked_id } = body;

        if (!blocked_id) {
            return NextResponse.json({ success: false, error: "Missing blocked_id" }, { status: 400 });
        }

        const pool = getDbPool();
        const blocker_id = caller.user_id;

        await pool.query(
            "INSERT INTO cabshare_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [blocker_id, blocked_id]
        );

        return NextResponse.json({ success: true, message: "User blocked successfully" });
    } catch (err: unknown) {
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const caller = await requireCabshareUser(req);
    if (caller instanceof NextResponse) return caller;
    try {
        const { searchParams } = new URL(req.url);
        const blocked_id = searchParams.get("blocked_id");

        if (!blocked_id) {
            return NextResponse.json({ success: false, error: "Missing blocked_id" }, { status: 400 });
        }

        const pool = getDbPool();
        const blocker_id = caller.user_id;

        await pool.query("DELETE FROM cabshare_blocks WHERE blocker_id = $1 AND blocked_id = $2", [blocker_id, blocked_id]);

        return NextResponse.json({ success: true, message: "User unblocked successfully" });
    } catch (err: unknown) {
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
