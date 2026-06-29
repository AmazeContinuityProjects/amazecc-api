/**
 * @openapi
 * /api/fresher-resources:
 *   get:
 *     tags:
 *       - Fresher Resources
 *     summary: Auto-generated GET endpoint for /api/fresher-resources
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               {}:
 *                 type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 resources: "sample_value"
 *                 success: true
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT id, title, description, url, icon, sort_order, type, content
       FROM fresher_resources
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, id ASC`
    );
    return NextResponse.json({ success: true, resources: rows });
  } catch (error: any) {
    console.error('fresher-resources error:', error.message);
    return NextResponse.json({ success: false, resources: [] });
  }
}
