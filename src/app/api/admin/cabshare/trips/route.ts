import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
    try {
        const pool = getDbPool();
        const { rows } = await pool.query(`
            SELECT t.*, u.name, u.reg_number, h.hub_name 
            FROM cabshare_trips t
            JOIN cabshare_users u ON t.user_id = u.user_id
            JOIN cabshare_hubs h ON t.hub_id = h.hub_id
            ORDER BY t.created_at DESC
        `);
        return NextResponse.json({ success: true, trips: rows });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const trip_id = searchParams.get("trip_id");
        if (!trip_id) return NextResponse.json({ success: false, error: "Missing trip_id" }, { status: 400 });

        const pool = getDbPool();
        await pool.query("DELETE FROM cabshare_trips WHERE trip_id = $1", [trip_id]);
        return NextResponse.json({ success: true, message: "Trip deleted successfully" });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
