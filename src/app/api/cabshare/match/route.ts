import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        // action can be: 'request', 'accept', 'reject', 'withdraw'
        const { reg_number, trip_id, action, match_id } = body;

        if (!reg_number || !action) {
            return NextResponse.json({ success: false, error: "Missing reg_number or action" }, { status: 400 });
        }

        const pool = getDbPool();
        const userRes = await pool.query("SELECT user_id FROM cabshare_users WHERE reg_number = $1", [reg_number]);
        if (userRes.rows.length === 0) {
            return NextResponse.json({ success: false, error: "User not found" }, { status: 401 });
        }
        const user_id = userRes.rows[0].user_id;

        if (action === 'request') {
            // Find trip owner
            const tripRes = await pool.query("SELECT user_id FROM cabshare_trips WHERE trip_id = $1", [trip_id]);
            if (tripRes.rows.length === 0) return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 });
            const owner_id = tripRes.rows[0].user_id;

            if (owner_id === user_id) {
                return NextResponse.json({ success: false, error: "Cannot request your own trip" }, { status: 400 });
            }

            await pool.query(
                "INSERT INTO cabshare_match_events (trip_id, requester_id, owner_id, status) VALUES ($1, $2, $3, 'pending') ON CONFLICT DO NOTHING",
                [trip_id, user_id, owner_id]
            );
            return NextResponse.json({ success: true, message: "Request sent" });
        }
        else if (action === 'accept' || action === 'reject') {
            // Owner is accepting or rejecting a request
            if (!match_id) return NextResponse.json({ success: false, error: "Missing match_id" }, { status: 400 });
            
            // Verify ownership
            const matchRes = await pool.query("SELECT owner_id FROM cabshare_match_events WHERE id = $1", [match_id]);
            if (matchRes.rows.length === 0) return NextResponse.json({ success: false, error: "Match not found" }, { status: 404 });
            if (matchRes.rows[0].owner_id !== user_id) {
                return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
            }

            await pool.query("UPDATE cabshare_match_events SET status = $1 WHERE id = $2", [action, match_id]);
            return NextResponse.json({ success: true, message: `Request ${action}ed` });
        }
        else if (action === 'withdraw') {
            if (!match_id && trip_id) {
                // withdraw by trip_id and requester_id
                await pool.query("UPDATE cabshare_match_events SET status = 'withdrawn' WHERE trip_id = $1 AND requester_id = $2", [trip_id, user_id]);
            } else if (match_id) {
                await pool.query("UPDATE cabshare_match_events SET status = 'withdrawn' WHERE id = $1 AND requester_id = $2", [match_id, user_id]);
            }
            return NextResponse.json({ success: true, message: "Request withdrawn" });
        }

        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });

    } catch (err: unknown) {
        console.error("CabShare Match POST Error:", err);
        return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}
