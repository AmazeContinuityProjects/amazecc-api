import { NextResponse } from 'next/server';
import { getApiDocs } from '@/lib/swagger';



/**
 * @openapi
 * /api/docs:
 *   get:
 *     tags:
 *       - Docs
 *     summary: GET endpoint for /api/docs
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

export async function GET() {
  const spec = getApiDocs();
  return NextResponse.json(spec);
}
