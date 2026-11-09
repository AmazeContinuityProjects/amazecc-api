import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { requireCabshareUser } from "@/lib/cabshareAuth";

export async function POST(req: Request) {
    const caller = await requireCabshareUser(req);
    if (caller instanceof NextResponse) return caller;
    try {
        const body = await req.json().catch(() => ({}));
        const { trip_id, ratee_id, score, comment } = body;

        if (!trip_id || !ratee_id || !score) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const pool = getDbPool();
        const rater_id = caller.user_id;

        const scoreNum = Number(score);
        if (!Number.isInteger(scoreNum) || scoreNum < 1 || scoreNum > 5) {
            return NextResponse.json({ success: false, error: "score must be 1-5" }, { status: 400 });
        }

        // Only people who actually shared this trip (owner + accepted requester) can rate each other.
        const shared = await pool.query(
            `SELECT 1 FROM cabshare_match_events
             WHERE trip_id = $1 AND status IN ('accepted', 'accept')
               AND ((owner_id = $2 AND requester_id = $3) OR (owner_id = $3 AND requester_id = $2))
             LIMIT 1`,
            [trip_id, rater_id, ratee_id]
        );
        if (shared.rows.length === 0) {
            return NextResponse.json({ success: false, error: "You can only rate people you shared this trip with" }, { status: 403 });
        }

        await pool.query(
            "INSERT INTO cabshare_ratings (trip_id, rater_id, ratee_id, score, comment) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING",
            [trip_id, rater_id, ratee_id, scoreNum, comment || null]
        );

        return NextResponse.json({ success: true, message: "Rating submitted" });
    } catch (err: unknown) {
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
