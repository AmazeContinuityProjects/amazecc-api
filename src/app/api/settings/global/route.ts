import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

async function ensureTable() {
    const pool = getDbPool();
    await pool.query(`
        CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY,
            value JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ DEFAULT now()
        )
    `);
}

export async function GET() {
    try {
        await ensureTable();
        const pool = getDbPool();
        const { rows } = await pool.query("SELECT key, value FROM app_config");
        const config: Record<string, unknown> = {};
        for (const row of rows) {
            config[row.key] = row.value;
        }
        return NextResponse.json({ success: true, config });
    } catch (err: unknown) {
        return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}
