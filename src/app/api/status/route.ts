import { NextResponse } from "next/server";




/**
 * @openapi
 * /api/status:
 *   get:
 *     tags:
 *       - System
 *     security: []
 *     summary: Check API health status
 *     description: >
 *       Simple health check endpoint used to verify that the API server
 *       is running and reachable.
 *     responses:
 *       200:
 *         description: API is up and running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 text:
 *                   type: string
 *                   example: API is working
 */

export async function GET(req: Request) {
  return NextResponse.json({ text: "API is working" }, { status: 200 });
}


