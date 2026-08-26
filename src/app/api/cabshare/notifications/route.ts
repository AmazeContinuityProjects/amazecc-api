import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const reg_number = searchParams.get("reg_number");
        if (!reg_number) return NextResponse.json({ success: false, error: "Missing reg_number" }, { status: 400 });

        const pool = getDbPool();
        const userRes = await pool.query("SELECT user_id FROM cabshare_users WHERE reg_number = $1", [reg_number]);
        if (userRes.rows.length === 0) return NextResponse.json({ success: true, notifications: [] });

        const user_id = userRes.rows[0].user_id;

        const { rows } = await pool.query(`
            SELECT * FROM cabshare_notifications 
            WHERE user_id = $1
            ORDER BY created_at DESC 
            LIMIT 50
        `, [user_id]);

        return NextResponse.json({ success: true, notifications: rows });
    } catch (err: unknown) {
        return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { reg_number, notif_id } = body;

        if (!reg_number) return NextResponse.json({ success: false, error: "Missing reg_number" }, { status: 400 });

        const pool = getDbPool();
        const userRes = await pool.query("SELECT user_id FROM cabshare_users WHERE reg_number = $1", [reg_number]);
        if (userRes.rows.length === 0) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
        
        const user_id = userRes.rows[0].user_id;

        if (notif_id === 'all') {
            await pool.query("UPDATE cabshare_notifications SET is_read = TRUE WHERE user_id = $1", [user_id]);
        } else {
            await pool.query("UPDATE cabshare_notifications SET is_read = TRUE WHERE notif_id = $1 AND user_id = $2", [notif_id, user_id]);
        }

        return NextResponse.json({ success: true, message: "Marked as read" });
    } catch (err: unknown) {
        return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}
