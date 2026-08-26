import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';



/**
 * @openapi
 * /api/marks/stats:
 *   get:
 *     tags:
 *       - Marks
 *     summary: GET endpoint for /api/marks/stats
 *     parameters:
 *       - name: classes
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const classes = searchParams.get('classes');
    
    if (!classes) {
      return NextResponse.json({ error: 'No classes provided' }, { status: 400 });
    }

    const classIds = classes.split(',');
    if (classIds.length === 0) {
      return NextResponse.json({ error: 'Empty classes list' }, { status: 400 });
    }

    const pool = getDbPool();

    const overallQuery = await pool.query(
      `SELECT class_id, count, mean, m2 FROM class_overall_stats WHERE class_id = ANY($1)`,
      [classIds]
    );

    const assessmentQuery = await pool.query(
      `SELECT class_id, assessment_title, count, mean, m2 FROM class_assessment_stats WHERE class_id = ANY($1)`,
      [classIds]
    );

    const result: Record<string, Record<string, unknown>> = {};

    for (const cid of classIds) {
      result[cid] = {
        overall: null,
        assessments: {}
      };
    }

    overallQuery.rows.forEach((row: Record<string, unknown>) => {
      const { class_id, count, mean, m2 } = row as { class_id: string; count: number; mean: number; m2: number };
      const sd = (count as number) > 1 ? Math.sqrt((m2 as number) / (count as number)) : 0;
      (result[class_id] as Record<string, unknown>).overall = { count, mean, sd };
    });

    assessmentQuery.rows.forEach((row: Record<string, unknown>) => {
      const { class_id, assessment_title, count, mean, m2 } = row as { class_id: string; assessment_title: string; count: number; mean: number; m2: number };
      const sd = (count as number) > 1 ? Math.sqrt((m2 as number) / (count as number)) : 0;
      ((result[class_id] as Record<string, unknown>).assessments as Record<string, unknown>)[assessment_title as string] = { count, mean, sd };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Marks stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
