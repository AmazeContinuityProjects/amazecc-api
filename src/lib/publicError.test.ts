import { describe, it, expect, vi } from 'vitest';
import { publicErrorMessage } from './publicError';

describe('publicErrorMessage', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    it('passes deliberate messages through', () => {
        expect(publicErrorMessage(new Error('Invalid Username / Password'))).toBe('Invalid Username / Password');
    });
    it('hides database errors', () => {
        const pgErr = Object.assign(new Error('relation "admin_users" does not exist'), { code: '42P01', severity: 'ERROR' });
        expect(publicErrorMessage(pgErr)).toBe('Internal server error');
        expect(publicErrorMessage(new Error('duplicate key value violates unique constraint "x_pkey"'))).toBe('Internal server error');
    });
    it('hides network / upstream errors', () => {
        expect(publicErrorMessage(Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:5432'), { code: 'ECONNREFUSED' }))).toBe('Internal server error');
        expect(publicErrorMessage(Object.assign(new Error('Request failed with status code 502'), { isAxiosError: true }))).toBe('Internal server error');
    });
    it('hides non-Error values', () => {
        expect(publicErrorMessage('boom')).toBe('Internal server error');
    });
});
