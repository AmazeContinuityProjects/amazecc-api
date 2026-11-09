import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { requireCabshareUser } from "@/lib/cabshareAuth";

export async function POST(req: Request) {
    const caller = await requireCabshareUser(req);
    if (caller instanceof NextResponse) return caller;
    try {
        const body = await req.json().catch(() => ({}));
        const { hub_id, travel_date } = body;

        if (!hub_id || !travel_date) {
            return NextResponse.json({ success: false, error: "Missing hub_id or travel_date" }, { status: 400 });
        }

        const pool = getDbPool();
        const user_id = caller.user_id;

        await pool.query(
            "INSERT INTO cabshare_waitlist (user_id, hub_id, travel_date) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            [user_id, hub_id, travel_date]
        );

        return NextResponse.json({ success: true, message: "Added to waitlist" });
    } catch (err: unknown) {
        console.error("CabShare Waitlist POST Error:", err);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
