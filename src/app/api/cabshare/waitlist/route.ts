import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { reg_number, hub_id, travel_date } = body;

        if (!reg_number || !hub_id || !travel_date) {
            return NextResponse.json({ success: false, error: "Missing reg_number, hub_id, or travel_date" }, { status: 400 });
        }

        const pool = getDbPool();
        const userRes = await pool.query("SELECT user_id FROM cabshare_users WHERE reg_number = $1", [reg_number]);
        if (userRes.rows.length === 0) {
            return NextResponse.json({ success: false, error: "User not found" }, { status: 401 });
        }
        const user_id = userRes.rows[0].user_id;

        await pool.query(
            "INSERT INTO cabshare_waitlist (user_id, hub_id, travel_date) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            [user_id, hub_id, travel_date]
        );

        return NextResponse.json({ success: true, message: "Added to waitlist" });
    } catch (err: unknown) {
        console.error("CabShare Waitlist POST Error:", err);
        return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}
