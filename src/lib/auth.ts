import crypto from 'crypto';
import { NextResponse } from 'next/server';

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
function generateSignature(payload: string): string {
    return crypto
        .createHmac('sha256', getSecret())
        .update(payload)
        .digest('hex');
}

/**
 * Signs a username to create a secure admin token.
 * Format: base64(payload).signature
 */
export function signAdminToken(username: string, role: 'superadmin' | 'admin' = 'superadmin', permissions: string[] = ['dashboard', 'qbank', 'buses', 'push', 'fresher-resources', 'faculty-directories', 'users', 'transport', 'gorobo']): string {
    const payloadObj = {
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
        if (Date.now() > payloadObj.exp) {
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
    return { username: payload.username, role: payload.role, permissions: payload.permissions };
}
