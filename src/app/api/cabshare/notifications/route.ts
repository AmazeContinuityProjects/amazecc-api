import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { requireCabshareUser } from "@/lib/cabshareAuth";

export async function GET(req: Request) {
    const caller = await requireCabshareUser(req);
    if (caller instanceof NextResponse) return caller;
    try {
        const pool = getDbPool();
        const user_id = caller.user_id;

        const { rows } = await pool.query(`
            SELECT * FROM cabshare_notifications 
            WHERE user_id = $1
            ORDER BY created_at DESC 
            LIMIT 50
        `, [user_id]);

        return NextResponse.json({ success: true, notifications: rows });
    } catch (err: unknown) {
        console.error("cabshare/notifications error:", err);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const caller = await requireCabshareUser(req);
    if (caller instanceof NextResponse) return caller;
    try {
        const body = await req.json().catch(() => ({}));
        const { notif_id } = body;

        const pool = getDbPool();
        const user_id = caller.user_id;

        if (notif_id === 'all') {
            await pool.query("UPDATE cabshare_notifications SET is_read = TRUE WHERE user_id = $1", [user_id]);
        } else {
            await pool.query("UPDATE cabshare_notifications SET is_read = TRUE WHERE notif_id = $1 AND user_id = $2", [notif_id, user_id]);
        }

        return NextResponse.json({ success: true, message: "Marked as read" });
    } catch (err: unknown) {
        console.error("cabshare/notifications error:", err);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
