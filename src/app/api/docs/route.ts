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
 */

export async function GET() {
  const spec = getApiDocs();
  return NextResponse.json(spec);
}
