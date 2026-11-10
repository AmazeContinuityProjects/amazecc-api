import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';



/**
 * @openapi
 * /api/notifications/status:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: GET endpoint for /api/notifications/status
 *     parameters:
 *       - name: endpoint
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    // Settings are looked up by the push endpoint, which only the subscribed
    // device knows. Looking up by UserID let anyone read anyone's settings.
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
        return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    try {
        const pool = getDbPool();
        const { rows } = await pool.query(
            `SELECT vitol_enabled, vitol_reminder_day, vitol_reminder_time 
             FROM push_subscriptions 
             WHERE endpoint = $1 LIMIT 1`,
            [endpoint]
        );

        if (rows.length === 0) {
            return NextResponse.json({
                vitol: false,
                vitol_reminder_day: 1,
                vitol_reminder_time: "10:00"
            });
        }

        return NextResponse.json({
            vitol: rows[0].vitol_enabled,
            vitol_reminder_day: rows[0].vitol_reminder_day,
            vitol_reminder_time: rows[0].vitol_reminder_time
        });
    } catch (error) {
        console.error("Status check error:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
}
