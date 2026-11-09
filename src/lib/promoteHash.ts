import crypto from 'crypto';
import { maskUserID } from '@/lib/mask';
import type { Pool } from 'pg';

/**
 * post_promotions.user_hash used to be an unsalted SHA-256 of the reg number,
 * which anyone holding the table can reverse by enumerating reg numbers. It is
 * now a keyed HMAC (ID_SALT), domain-separated so it can't be joined against
 * the marks/social tables.
 */
export function promoteHash(vtop_id: string): string {
    return maskUserID(`post-promotion:${vtop_id.trim().toUpperCase()}`);
}

function legacyHash(vtop_id: string): string {
    return crypto.createHash('sha256').update(vtop_id).digest('hex');
}

/** Rewrites this user's legacy rows to the keyed hash. Cheap no-op once done. */
export async function migrateLegacyPromotions(pool: Pool, vtop_id: string): Promise<string> {
    const hash = promoteHash(vtop_id);
    await pool.query(
        `UPDATE post_promotions SET user_hash = $1
         WHERE user_hash = $2
           AND NOT EXISTS (SELECT 1 FROM post_promotions q WHERE q.post_id = post_promotions.post_id AND q.user_hash = $1)`,
        [hash, legacyHash(vtop_id)]
    );
    await pool.query('DELETE FROM post_promotions WHERE user_hash = $1', [legacyHash(vtop_id)]);
    return hash;
}
