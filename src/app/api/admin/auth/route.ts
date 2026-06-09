import { NextResponse } from 'next/server';
import { signAdminToken } from '@/lib/auth';

/**
 * @swagger
 * /api/admin/auth:
 *   post:
 *     summary: Authenticate an admin user
 *     description: Authenticates a user against VTOP credentials and a VIP list of admin IDs.
 *     tags:
 *       - Admin
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful authentication
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 username:
 *                   type: string
 *                 token:
 *                   type: string
 *       400:
 *         description: Username and password required
 *       401:
 *         description: Invalid VTOP Credentials or VTOP is down
 *       403:
 *         description: Access Denied
 *       500:
 *         description: Internal Server Error
 */
/**
 * @openapi
 * /api/admin/auth:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST endpoint for /api/admin/auth
 *     responses:
 *       200:
 *         description: Successful response
 */

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ error: "Username and password required" }, { status: 400 });
        }

        // 1. Verify credentials against VTOP (via our own backend login route)
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
        const loginRes = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        if (!loginRes.ok) {
            return NextResponse.json({ error: "Invalid VTOP Credentials or VTOP is down" }, { status: 401 });
        }

        // 2. Check against VIP list
        const adminIdsEnv = process.env.ADMIN_VTOP_IDS || "";
        const adminIds = adminIdsEnv.split(',').map(id => id.trim().toUpperCase());
        
        if (!adminIds.includes(username.toUpperCase())) {
            return NextResponse.json({ error: "Access Denied: You are not an authorized administrator." }, { status: 403 });
        }

        // 3. Generate signed token
        const token = signAdminToken(username.toUpperCase());

        // 4. Return token to frontend
        return NextResponse.json({ success: true, username: username.toUpperCase(), token });

    } catch (err: any) {
        console.error("Admin auth error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
