import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
    try {
        const pool = getDbPool();
        
        // Count total trips
        const tripRes = await pool.query("SELECT COUNT(*) as total FROM cabshare_trips");
        const totalTrips = tripRes.rows[0].total;

        // Count active trips
        const activeTripRes = await pool.query("SELECT COUNT(*) as total FROM cabshare_trips WHERE status = 'active'");
        const activeTrips = activeTripRes.rows[0].total;

        // Count total users
        const userRes = await pool.query("SELECT COUNT(*) as total FROM cabshare_users");
        const totalUsers = userRes.rows[0].total;

        // Count most popular hub
        const popularHubRes = await pool.query(`
            SELECT h.hub_name, COUNT(t.trip_id) as trip_count 
            FROM cabshare_hubs h
            LEFT JOIN cabshare_trips t ON h.hub_id = t.hub_id
            GROUP BY h.hub_name
            ORDER BY trip_count DESC
            LIMIT 3
        `);
        const popularHubs = popularHubRes.rows;

        return NextResponse.json({ 
            success: true, 
            stats: {
                totalTrips: parseInt(totalTrips),
                activeTrips: parseInt(activeTrips),
                totalUsers: parseInt(totalUsers),
                popularHubs
            }
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
