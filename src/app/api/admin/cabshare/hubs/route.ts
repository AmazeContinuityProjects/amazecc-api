import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { hub_name, city } = body;
        if (!hub_name) return NextResponse.json({ success: false, error: "Missing hub_name" }, { status: 400 });

        const pool = getDbPool();
        const { rows } = await pool.query(
            "INSERT INTO cabshare_hubs (hub_name, city) VALUES ($1, $2) RETURNING *",
            [hub_name, city || 'Chennai']
        );
        return NextResponse.json({ success: true, hub: rows[0] });
    } catch (err: unknown) {
        return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const hub_id = searchParams.get("hub_id");
        if (!hub_id) return NextResponse.json({ success: false, error: "Missing hub_id" }, { status: 400 });

        const pool = getDbPool();
        await pool.query("DELETE FROM cabshare_hubs WHERE hub_id = $1", [hub_id]);
        return NextResponse.json({ success: true, message: "Hub deleted successfully" });
    } catch (err: unknown) {
        return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}
