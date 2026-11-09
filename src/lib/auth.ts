import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

function getSecret(): string {
    const secret = process.env.ADMIN_SECRET;
    if (!secret) {
        throw new Error('ADMIN_SECRET environment variable is required');
    }
    return secret;
}

export interface AdminTokenPayload {
    username: string;
    role: 'superadmin' | 'admin';
    permissions: string[];
    exp: number;
}

/**
 * Generates an HMAC SHA-256 signature for the given payload.
 */
// Admin and club tokens share ADMIN_SECRET, so each type signs with its own
// derived key. Without this, a club token verified as an admin token.
const TOKEN_TYPE = 'admin';

function signingKey(): Buffer {
    return crypto.createHmac('sha256', getSecret()).update(`amazecc-token:${TOKEN_TYPE}`).digest();
}

function generateSignature(payload: string): string {
    return crypto
        .createHmac('sha256', signingKey())
        .update(payload)
        .digest('hex');
}

/**
 * Signs a username to create a secure admin token.
 * Format: base64(payload).signature
 */
export const SUPERADMIN_PERMISSIONS = ['dashboard', 'qbank', 'buses', 'push', 'fresher-resources', 'faculty-directories', 'faculty-directory', 'users', 'transport', 'gorobo'];

export function signAdminToken(username: string, role: 'superadmin' | 'admin' = 'superadmin', permissions: string[] = SUPERADMIN_PERMISSIONS): string {
    const payloadObj = {
        typ: TOKEN_TYPE,
        username,
        role,
        permissions,
        exp: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days expiration
    };
    
    const payloadStr = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
    const signature = generateSignature(payloadStr);
    
    return `${payloadStr}.${signature}`;
}

/**
 * Verifies a token and returns the payload if valid and not expired.
 * Returns null if invalid or expired.
 */
export function verifyAdminToken(token: string): AdminTokenPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 2) return null;
        
        const [payloadStr, signature] = parts;
        
        // Verify signature
        const expectedSignature = generateSignature(payloadStr);
        // Use timingSafeEqual to prevent timing attacks
        const isValid = crypto.timingSafeEqual(
            Buffer.from(signature, 'utf8'),
            Buffer.from(expectedSignature, 'utf8')
        );
        
        if (!isValid) return null;
        
        // Parse payload
        const payloadObj = JSON.parse(Buffer.from(payloadStr, 'base64').toString('utf8'));
        
        // Check expiration
        if (payloadObj.typ !== TOKEN_TYPE) return null;

        if (typeof payloadObj.exp !== 'number' || Date.now() > payloadObj.exp) {
            return null; // Token expired
        }
        
        return payloadObj as AdminTokenPayload;
    } catch {
        return null;
    }
}

export function getAdminTokenFromRequest(req: Request): string | null {
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return null;
}

export async function verifyAdminFromRequest(req: Request): Promise<AdminTokenPayload | null> {
    const token = getAdminTokenFromRequest(req);
    if (token) {
        return verifyAdminToken(token);
    }
    return null;
}

export async function requireAdminAuth(req: Promise<Request> | Request): Promise<{ username: string; role: 'superadmin' | 'admin'; permissions: string[] } | NextResponse> {
    const request = await req;
    const payload = await verifyAdminFromRequest(request);
    if (!payload) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const current = await currentAdminGrant(payload.username);
    if (!current) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return { username: payload.username, ...current };
}

/**
 * Tokens are valid for 7 days, so the signature alone can't reflect a
 * deactivation or a permission change made after login. Re-read the grant on
 * every admin request (admin traffic is tiny). Env superadmins (ADMIN_VTOP_IDS)
 * stay valid without the DB, matching /api/admin/auth; everyone else fails
 * closed if the row is missing, inactive, or the DB can't be reached.
 */
async function currentAdminGrant(
    username: string
): Promise<{ role: 'superadmin' | 'admin'; permissions: string[] } | null> {
    const normalized = String(username || '').toUpperCase().trim();
    const envSuperadmins = (process.env.ADMIN_VTOP_IDS || '')
        .split(',')
        .map((id) => id.trim().toUpperCase())
        .filter(Boolean);
    if (envSuperadmins.includes(normalized)) {
        return { role: 'superadmin', permissions: SUPERADMIN_PERMISSIONS };
    }
    try {
        const { rows } = await getDbPool().query(
            'SELECT role, permissions, is_active FROM admin_users WHERE username = $1',
            [normalized]
        );
        const row = rows[0];
        if (!row || !row.is_active) return null;
        const perms = Array.isArray(row.permissions)
            ? row.permissions
            : typeof row.permissions === 'string'
              ? JSON.parse(row.permissions)
              : [];
        return { role: row.role === 'superadmin' ? 'superadmin' : 'admin', permissions: perms };
    } catch (err) {
        console.error('[auth] admin grant lookup failed:', err);
        return null;
    }
}

/**
 * Helper to check if an authenticated admin user has one or more required permissions.
 * Superadmins always bypass permission checks.
 */
export function hasAdminPermission(
    admin: { role: 'superadmin' | 'admin'; permissions: string[] },
    required: string | string[]
): boolean {
    if (admin.role === 'superadmin') return true;
    const perms = Array.isArray(required) ? required : [required];
    return perms.some(p => admin.permissions?.includes(p));
}

