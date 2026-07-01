import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { reg_number, blocked_id } = body;

        if (!reg_number || !blocked_id) {
            return NextResponse.json({ success: false, error: "Missing reg_number or blocked_id" }, { status: 400 });
        }

        const pool = getDbPool();
        const userRes = await pool.query("SELECT user_id FROM cabshare_users WHERE reg_number = $1", [reg_number]);
        if (userRes.rows.length === 0) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
        
        const blocker_id = userRes.rows[0].user_id;

        await pool.query(
            "INSERT INTO cabshare_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [blocker_id, blocked_id]
        );

        return NextResponse.json({ success: true, message: "User blocked successfully" });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const reg_number = searchParams.get("reg_number");
        const blocked_id = searchParams.get("blocked_id");

        if (!reg_number || !blocked_id) {
            return NextResponse.json({ success: false, error: "Missing params" }, { status: 400 });
        }

        const pool = getDbPool();
        const userRes = await pool.query("SELECT user_id FROM cabshare_users WHERE reg_number = $1", [reg_number]);
        if (userRes.rows.length === 0) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
        
        const blocker_id = userRes.rows[0].user_id;

        await pool.query("DELETE FROM cabshare_blocks WHERE blocker_id = $1 AND blocked_id = $2", [blocker_id, blocked_id]);

        return NextResponse.json({ success: true, message: "User unblocked successfully" });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
