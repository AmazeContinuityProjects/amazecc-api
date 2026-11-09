import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { requireCabshareUser } from "@/lib/cabshareAuth";

export async function POST(req: Request) {
    const caller = await requireCabshareUser(req);
    if (caller instanceof NextResponse) return caller;
    try {
        const body = await req.json().catch(() => ({}));
        // action can be: 'request', 'accept', 'reject', 'withdraw'
        const { trip_id, action, match_id } = body;

        if (!action) {
            return NextResponse.json({ success: false, error: "Missing action" }, { status: 400 });
        }

        const pool = getDbPool();
        const user_id = caller.user_id;

        if (action === 'request') {
            // Find trip owner
            const tripRes = await pool.query("SELECT user_id FROM cabshare_trips WHERE trip_id = $1", [trip_id]);
            if (tripRes.rows.length === 0) return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 });
            const owner_id = tripRes.rows[0].user_id;

            const blocked = await pool.query(
                "SELECT 1 FROM cabshare_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1",
                [owner_id, user_id]
            );
            if (blocked.rows.length > 0) {
                return NextResponse.json({ success: false, error: "Cannot request this trip" }, { status: 403 });
            }

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

            // Frontend expects "accepted"/"rejected"; older rows may hold "accept".
            const newStatus = action === "accept" ? "accepted" : "rejected";
            await pool.query("UPDATE cabshare_match_events SET status = $1 WHERE id = $2", [newStatus, match_id]);
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
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
