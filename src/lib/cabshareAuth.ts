import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

// Cab-share session tokens. Issued by /api/cabshare/auth after a VTOP login,
// so the reg number inside is one VTOP vouched for. Signed with a key derived
// from ADMIN_SECRET under its own label, so these tokens can never verify as
// admin or club tokens (and vice versa).
const TOKEN_TYPE = 'cabshare';
const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function signingKey(): Buffer {
    const secret = process.env.ADMIN_SECRET;
    if (!secret) throw new Error('ADMIN_SECRET environment variable is required');
    return crypto.createHmac('sha256', secret).update(`amazecc-token:${TOKEN_TYPE}`).digest();
}

function sign(payload: string): string {
    return crypto.createHmac('sha256', signingKey()).update(payload).digest('hex');
}

export function signCabshareToken(reg_number: string): string {
    const payload = Buffer.from(
        JSON.stringify({ typ: TOKEN_TYPE, reg: reg_number, exp: Date.now() + TTL_MS })
    ).toString('base64');
    return `${payload}.${sign(payload)}`;
}

export function verifyCabshareToken(token: string): string | null {
    try {
        const [payload, signature, extra] = token.split('.');
        if (!payload || !signature || extra !== undefined) return null;
        const expected = Buffer.from(sign(payload), 'utf8');
        const given = Buffer.from(signature, 'utf8');
        if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

        const obj = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
        if (obj.typ !== TOKEN_TYPE || typeof obj.reg !== 'string' || !obj.reg) return null;
        if (typeof obj.exp !== 'number' || Date.now() > obj.exp) return null;
        return obj.reg;
    } catch {
        return null;
    }
}

export interface CabshareCaller {
    user_id: number;
    reg_number: string;
}

/**
 * Resolves the caller from `Authorization: Bearer <cabshare token>`.
 * Returns a 401 response when the token is missing/invalid or the user row is gone.
 */
export async function requireCabshareUser(req: Request): Promise<CabshareCaller | NextResponse> {
    const header = req.headers.get('Authorization');
    const reg = header?.startsWith('Bearer ') ? verifyCabshareToken(header.slice(7)) : null;
    if (!reg) {
        return NextResponse.json(
            { success: false, error: 'Cab-share sign-in required' },
            { status: 401 }
        );
    }
    const { rows } = await getDbPool().query(
        'SELECT user_id, reg_number FROM cabshare_users WHERE reg_number = $1',
        [reg]
    );
    if (rows.length === 0) {
        return NextResponse.json(
            { success: false, error: 'Cab-share sign-in required' },
            { status: 401 }
        );
    }
    return { user_id: rows[0].user_id, reg_number: rows[0].reg_number };
}
