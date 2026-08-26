import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { reg_number, hub_id, travel_date, preferred_time, tolerance_hours, seat_options, gender_preference, notes } = body;

        if (!reg_number || !hub_id || !travel_date || !preferred_time || !seat_options || !gender_preference) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const pool = getDbPool();
        
        // Find internal user_id
        const userRes = await pool.query("SELECT user_id FROM cabshare_users WHERE reg_number = $1", [reg_number]);
        if (userRes.rows.length === 0) {
            return NextResponse.json({ success: false, error: "User not found. Please authenticate first." }, { status: 401 });
        }
        const user_id = userRes.rows[0].user_id;

        const insertQuery = `
            INSERT INTO cabshare_trips (user_id, hub_id, travel_date, preferred_time, tolerance_hours, seat_options, gender_preference, notes, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
            RETURNING trip_id
        `;
        const { rows } = await pool.query(insertQuery, [
            user_id, hub_id, travel_date, preferred_time, tolerance_hours || 0, JSON.stringify(seat_options), gender_preference, notes || null
        ]);

        const trip_id = rows[0].trip_id;

        // Process waitlist
        const waitlistRes = await pool.query(`
            SELECT w.user_id, w.waitlist_id, u.reg_number 
            FROM cabshare_waitlist w
            JOIN cabshare_users u ON w.user_id = u.user_id
            WHERE w.hub_id = $1 AND w.travel_date = $2 AND w.user_id != $3
        `, [hub_id, travel_date, user_id]);

        if (waitlistRes.rows.length > 0) {
            // Send notifications to everyone on waitlist
            for (const wl of waitlistRes.rows) {
                await pool.query(`
                    INSERT INTO cabshare_notifications (user_id, title, message, type)
                    VALUES ($1, $2, $3, $4)
                `, [
                    wl.user_id, 
                    "Ride Match Found!", 
                    `A new ride has been posted for your waitlisted date (${travel_date}). Check it out!`, 
                    "waitlist_alert"
                ]);
                // Delete them from waitlist since they've been alerted
                await pool.query("DELETE FROM cabshare_waitlist WHERE waitlist_id = $1", [wl.waitlist_id]);
            }
        }

        return NextResponse.json({ success: true, trip_id });
    } catch (err: unknown) {
        console.error("CabShare Trips POST Error:", err);
        return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const hub_id = searchParams.get("hub_id");
        const date = searchParams.get("date");
        const reg_number = searchParams.get("reg_number"); // Exclude own trips from search

        const pool = getDbPool();
        let query = `
            SELECT t.*, u.name, u.reg_number as owner_reg_number, h.hub_name, h.city 
            FROM cabshare_trips t
            JOIN cabshare_users u ON t.user_id = u.user_id
            JOIN cabshare_hubs h ON t.hub_id = h.hub_id
            WHERE t.status = 'active'
        `;
        const params: unknown[] = [];
        let paramIdx = 1;

        if (hub_id) {
            query += ` AND t.hub_id = $${paramIdx++}`;
            params.push(hub_id);
        }
        if (date) {
            query += ` AND t.travel_date = $${paramIdx++}`;
            params.push(date);
        }
        if (reg_number) {
            query += ` AND u.reg_number != $${paramIdx++}`;
            params.push(reg_number);
        }

        query += ` ORDER BY t.travel_date ASC, t.preferred_time ASC`;

        const { rows } = await pool.query(query, params);
        
        return NextResponse.json({ success: true, trips: rows });
    } catch (err: unknown) {
        console.error("CabShare Trips GET Error:", err);
        return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}
