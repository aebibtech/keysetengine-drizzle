import { describe, expect, it } from 'bun:test';
import { Base64UrlCursorProtector } from '../../src/crypto/base64url-protector.js';
import type { KeysetCursorToken } from '../../src/types.js';

describe('Base64UrlCursorProtector', () => {
  const protector = new Base64UrlCursorProtector();

  const sampleToken: KeysetCursorToken = {
    sortValue: '2026-10-20T08:00:00.000Z',
    tieBreakerValue: 12345,
    isAscending: true,
    searchHash: 'a1b2c3d4e5f60718',
  };

  it('roundtrips valid cursor tokens correctly', () => {
    const protectedCursor = protector.protect(sampleToken, 'orders');
    expect(typeof protectedCursor).toBe('string');
    expect(protectedCursor.length).toBeGreaterThan(0);

    const unprotected = protector.unprotect(protectedCursor, 'orders');
    expect(unprotected).not.toBeNull();
    expect(unprotected).toEqual(sampleToken);
  });

  it('gracefully returns null for null, empty, or whitespace cursors', () => {
    expect(protector.unprotect(null, 'orders')).toBeNull();
    expect(protector.unprotect(undefined, 'orders')).toBeNull();
    expect(protector.unprotect('', 'orders')).toBeNull();
    expect(protector.unprotect('   ', 'orders')).toBeNull();
  });

  it('gracefully returns null for corrupted base64 or invalid JSON payload', () => {
    expect(protector.unprotect('this-is-not-valid-base64-json!!!', 'orders')).toBeNull();

    // Valid base64, but invalid JSON structure
    const invalidJsonBase64 = Buffer.from('{"invalid":"json"}', 'utf8').toString('base64url');
    expect(protector.unprotect(invalidJsonBase64, 'orders')).toBeNull();
  });

  it('throws an error if protect is called with a null or undefined token', () => {
    expect(() => protector.protect(null as any, 'orders')).toThrow();
  });
});
