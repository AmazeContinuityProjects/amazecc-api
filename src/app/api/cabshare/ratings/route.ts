import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { reg_number, trip_id, ratee_id, score, comment } = body;

        if (!reg_number || !trip_id || !ratee_id || !score) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const pool = getDbPool();
        const userRes = await pool.query("SELECT user_id FROM cabshare_users WHERE reg_number = $1", [reg_number]);
        if (userRes.rows.length === 0) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
        
        const rater_id = userRes.rows[0].user_id;

        await pool.query(
            "INSERT INTO cabshare_ratings (trip_id, rater_id, ratee_id, score, comment) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING",
            [trip_id, rater_id, ratee_id, score, comment || null]
        );

        return NextResponse.json({ success: true, message: "Rating submitted" });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
