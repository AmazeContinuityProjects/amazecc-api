import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const reg_number = searchParams.get("reg_number");

        if (!reg_number) {
            return NextResponse.json({ success: false, error: "Missing reg_number" }, { status: 400 });
        }

        const pool = getDbPool();
        const userRes = await pool.query("SELECT user_id FROM cabshare_users WHERE reg_number = $1", [reg_number]);
        if (userRes.rows.length === 0) {
            return NextResponse.json({ success: true, my_trips: [], joined_trips: [] });
        }
        const user_id = userRes.rows[0].user_id;

        // Trips created by the user
        const { rows: myTrips } = await pool.query(`
            SELECT t.*, h.hub_name, h.city 
            FROM cabshare_trips t
            JOIN cabshare_hubs h ON t.hub_id = h.hub_id
            WHERE t.user_id = $1
            ORDER BY t.travel_date DESC, t.preferred_time DESC
        `, [user_id]);

        // Trips the user requested to join
        const { rows: joinedTrips } = await pool.query(`
            SELECT t.*, h.hub_name, h.city, m.status as match_status, u.name as owner_name, u.phone_number as owner_phone
            FROM cabshare_match_events m
            JOIN cabshare_trips t ON m.trip_id = t.trip_id
            JOIN cabshare_hubs h ON t.hub_id = h.hub_id
            JOIN cabshare_users u ON t.user_id = u.user_id
            WHERE m.requester_id = $1
            ORDER BY t.travel_date DESC, t.preferred_time DESC
        `, [user_id]);

        // For myTrips, let's also fetch requests on those trips
        for (let trip of myTrips) {
            const reqs = await pool.query(`
                SELECT m.id as match_id, m.status, u.name, u.reg_number, u.phone_number 
                FROM cabshare_match_events m
                JOIN cabshare_users u ON m.requester_id = u.user_id
                WHERE m.trip_id = $1
            `, [trip.trip_id]);
            trip.requests = reqs.rows;
        }

        return NextResponse.json({ success: true, my_trips: myTrips, joined_trips: joinedTrips });
    } catch (err: any) {
        console.error("CabShare My Trips GET Error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
