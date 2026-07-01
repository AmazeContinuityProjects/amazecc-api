import crypto from 'crypto';
import { NextResponse } from 'next/server';

// We can reuse ADMIN_SECRET or use a CLUB_SECRET if available. For now, use ADMIN_SECRET since it's already set.
if (!process.env.ADMIN_SECRET) {
  throw new Error('ADMIN_SECRET environment variable is required');
}
const SECRET = process.env.ADMIN_SECRET;

export interface ClubRole {
    club_id: string;
    role: string;
}

export interface ClubTokenPayload {
    vtop_id: string;
    clubs: ClubRole[];
    club_id: string;
    role: string;
    exp: number;
}

/**
 * Generates an HMAC SHA-256 signature for the given payload.
 */
function generateSignature(payload: string): string {
    return crypto
        .createHmac('sha256', SECRET)
        .update(payload)
        .digest('hex');
}

/**
 * Signs a club representative token.
 * Format: base64(payload).signature
 */
export function signClubToken(vtop_id: string, clubs: ClubRole[]): string {
    const payloadObj = {
        vtop_id,
        clubs,
        club_id: clubs[0]?.club_id || '',
        role: clubs[0]?.role || 'representative',
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
export function verifyClubToken(token: string): ClubTokenPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 2) return null;
        
        const [payloadStr, signature] = parts;
        
        const expectedSignature = generateSignature(payloadStr);
        const isValid = crypto.timingSafeEqual(
            Buffer.from(signature, 'utf8'),
            Buffer.from(expectedSignature, 'utf8')
        );
        
        if (!isValid) return null;
        
        const payloadObj = JSON.parse(Buffer.from(payloadStr, 'base64').toString('utf8'));
        
        if (Date.now() > payloadObj.exp) {
            return null;
        }
        
        return payloadObj as ClubTokenPayload;
    } catch (err) {
        return null;
    }
}

export function getClubTokenFromRequest(req: Request): string | null {
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return null;
}

export async function verifyClubAuthFromRequest(req: Request): Promise<ClubTokenPayload | null> {
    const token = getClubTokenFromRequest(req);
    if (token) {
        return verifyClubToken(token);
    }
    return null;
}

export async function requireClubAuth(req: Promise<Request> | Request): Promise<ClubTokenPayload | NextResponse> {
    const request = await req;
    const payload = await verifyClubAuthFromRequest(request);
    if (!payload) {
        return NextResponse.json({ success: false, error: 'Unauthorized Club Access' }, { status: 401 });
    }

    const xClubId = request.headers.get('x-club-id') || request.headers.get('X-Club-Id');
    if (xClubId && payload.clubs) {
        const clubContext = payload.clubs.find(c => c.club_id === xClubId);
        
        if (clubContext) {
            payload.club_id = clubContext.club_id;
            payload.role = clubContext.role;
        } else if (payload.clubs.some(c => c.role === 'super-club-rep')) {
            payload.club_id = xClubId;
            payload.role = 'super-club-rep';
        } else {
            return NextResponse.json({ success: false, error: 'Unauthorized for this club' }, { status: 403 });
        }
    }

    return payload;
}
