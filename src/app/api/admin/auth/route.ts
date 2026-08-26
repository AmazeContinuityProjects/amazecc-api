import { NextResponse } from 'next/server';
import { signAdminToken } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rateLimit';
import { logAdminAction } from '@/lib/audit';

/**
 * @swagger
 * /api/admin/auth:
 *   post:
 *     summary: Authenticate an admin user
 *     description: Authenticates a user against VTOP credentials and checks admin status from env var or database.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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

export async function POST(req: Request) {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`admin-auth:${ip}`, 5, 60000);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

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

        const normalizedUsername = username.toUpperCase().trim();

        // 2. Check if user is superadmin (from env var)
        const adminIdsEnv = process.env.ADMIN_VTOP_IDS || "";
        const adminIds = adminIdsEnv.split(',').map(id => id.trim().toUpperCase());
        const isSuperadmin = adminIds.includes(normalizedUsername);

        // 3. Check if user exists in admin_users table
        let role: 'superadmin' | 'admin';
        let permissions: string[];

        if (isSuperadmin) {
            // Superadmin from env var - full access
            role = 'superadmin';
            permissions = ['dashboard', 'qbank', 'buses', 'push', 'fresher-resources', 'faculty-directories', 'faculty-directory', 'users', 'transport', 'gorobo'];
            
            // Ensure superadmin exists in database
            try {
                const pool = getDbPool();
                const { rows: existing } = await pool.query(
                    'SELECT username FROM admin_users WHERE username = $1',
                    [normalizedUsername]
                );
                
                if (existing.length === 0) {
                    // Auto-create superadmin in database
                    await pool.query(
                        `INSERT INTO admin_users (username, role, permissions, added_by)
                         VALUES ($1, 'superadmin', $2, 'SYSTEM')`,
                        [normalizedUsername, JSON.stringify(permissions)]
                    );
                } else if (existing[0].role !== 'superadmin') {
                    // Upgrade to superadmin if they were previously just admin
                    await pool.query(
                        'UPDATE admin_users SET role = $1, permissions = $2 WHERE username = $3',
                        ['superadmin', JSON.stringify(permissions), normalizedUsername]
                    );
                }
            } catch (dbError) {
                // Database might not have admin_users table yet, proceed with env var auth
                console.warn('Could not check admin_users table:', dbError);
            }
        } else {
            // Check database for regular admin
            try {
                const pool = getDbPool();
                const { rows } = await pool.query(
                    'SELECT role, permissions, is_active FROM admin_users WHERE username = $1',
                    [normalizedUsername]
                );

                if (rows.length === 0) {
                    return NextResponse.json(
                        { error: "Access Denied: You are not an authorized administrator." },
                        { status: 403 }
                    );
                }

                const user = rows[0];
                if (!user.is_active) {
                    return NextResponse.json(
                        { error: "Access Denied: Your account has been deactivated." },
                        { status: 403 }
                    );
                }

                role = user.role;
                permissions = user.permissions;
            } catch (dbError) {
                // Database might not have admin_users table yet, deny access
                console.error('Database error checking admin status:', dbError);
                return NextResponse.json(
                    { error: "Access Denied: Unable to verify admin status." },
                    { status: 403 }
                );
            }
        }

        // 4. Record admin login in audit log
        await logAdminAction({
            admin_user: normalizedUsername,
            action: 'Admin Login',
            target_resource: '/api/admin/auth',
            details: {
                role,
                permissions,
                auth_method: isSuperadmin ? 'ENV_SUPERADMIN' : 'DB_ADMIN',
                login_timestamp: new Date().toISOString()
            },
            ip_address: ip,
            user_agent: req.headers.get('user-agent') || ''
        });

        // 5. Generate signed token with role and permissions
        const token = signAdminToken(normalizedUsername, role, permissions);

        // 6. Return token to frontend
        return NextResponse.json({
            success: true,
            username: normalizedUsername,
            role,
            permissions,
            token
        });

    } catch (err: unknown) {
        console.error("Admin auth error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
