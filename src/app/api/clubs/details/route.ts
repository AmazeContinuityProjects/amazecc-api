import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET() {
    try {
        const pool = getDbPool();
        const result = await pool.query('SELECT * FROM club_details ORDER BY club_name ASC');
        return NextResponse.json({ success: true, clubs: result.rows }, { status: 200 });
    } catch (error: unknown) {
        console.error('Error fetching club details in GET:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch club details' }, { status: 500 });
    }
}
