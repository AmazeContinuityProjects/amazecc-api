import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
    try {
        const pool = getDbPool();
        const { rows } = await pool.query("SELECT * FROM cabshare_hubs ORDER BY hub_id ASC");
        
        return NextResponse.json({ success: true, hubs: rows });
    } catch (err: any) {
        console.error("CabShare Hubs Error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
