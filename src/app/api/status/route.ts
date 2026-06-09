import { NextResponse } from "next/server";






/**
 * @openapi
 * /api/status:
 *   get:
 *     tags:
 *       - Status
 *     summary: GET endpoint for /api/status
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
  return NextResponse.json({ text: "API is working" }, { status: 200 });
}


