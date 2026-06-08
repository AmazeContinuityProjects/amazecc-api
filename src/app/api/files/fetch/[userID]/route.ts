import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { maskUserID } from '@/lib/mask';

export async function GET(req: Request, { params }: { params: Promise<{ userID: string }> }) {
    try {
        const pool = getDbPool();
        const { userID } = await params;
        const maskedID = maskUserID(userID.toUpperCase());

        const { rows } = await pool.query(
            `SELECT file_id as "fileID", extension, name, size, expires_at as "expiresAt" 
             FROM files 
             WHERE user_id = $1 AND expires_at > NOW()`,
            [maskedID]
        );

        return NextResponse.json(rows);
    } catch (error) {
        console.error("Error fetching files:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
