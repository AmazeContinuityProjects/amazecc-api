import { describe, it, expect, beforeAll } from 'vitest';
import { signAdminToken, verifyAdminToken } from './auth';
import { signClubToken, verifyClubToken } from './clubAuth';
import { signCabshareToken, verifyCabshareToken } from './cabshareAuth';

beforeAll(() => {
    process.env.ADMIN_SECRET = 'test-secret-for-token-separation';
});

describe('token types do not cross-verify', () => {
    it('club token is rejected as admin token', () => {
        const club = signClubToken('24BCE1234', [{ club_id: '1', role: 'representative' }]);
        expect(verifyClubToken(club)?.vtop_id).toBe('24BCE1234');
        expect(verifyAdminToken(club)).toBeNull();
        expect(verifyCabshareToken(club)).toBeNull();
    });

    it('admin token is rejected as club / cabshare token', () => {
        const admin = signAdminToken('root');
        expect(verifyAdminToken(admin)?.username).toBe('root');
        expect(verifyClubToken(admin)).toBeNull();
        expect(verifyCabshareToken(admin)).toBeNull();
    });

    it('cabshare token round-trips and is rejected elsewhere', () => {
        const t = signCabshareToken('24BCE1234');
        expect(verifyCabshareToken(t)).toBe('24BCE1234');
        expect(verifyAdminToken(t)).toBeNull();
        expect(verifyClubToken(t)).toBeNull();
    });

    it('tampered cabshare payload is rejected', () => {
        const [, sig] = signCabshareToken('24BCE1234').split('.');
        const forged = Buffer.from(
            JSON.stringify({ typ: 'cabshare', reg: '24BCE9999', exp: Date.now() + 1e9 })
        ).toString('base64');
        expect(verifyCabshareToken(`${forged}.${sig}`)).toBeNull();
        expect(verifyCabshareToken('garbage')).toBeNull();
    });
});
