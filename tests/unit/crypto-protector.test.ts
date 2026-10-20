import { describe, expect, it } from 'bun:test';
import { CryptoCursorProtector } from '../../src/crypto/crypto-protector.js';
import type { KeysetCursorToken } from '../../src/types.js';

describe('CryptoCursorProtector (AES-256-GCM + HKDF)', () => {
  const secretKey = 'test-encryption-master-secret-for-keyset-tokens-32b';
  const protector = new CryptoCursorProtector(secretKey);

  const sampleToken: KeysetCursorToken = {
    sortValue: '2026-10-20T08:00:00.000Z',
    tieBreakerValue: 998877,
    isAscending: false,
    searchHash: 'deadbeef12345678',
  };

  it('successfully encrypts and decrypts a cursor token with valid purpose', () => {
    const opaque = protector.protect(sampleToken, 'orders');
    expect(typeof opaque).toBe('string');
    // Ensure it's opaque and not plain base64 json
    expect(opaque).not.toContain('sortValue');

    const decrypted = protector.unprotect(opaque, 'orders');
    expect(decrypted).not.toBeNull();
    expect(decrypted).toEqual(sampleToken);
  });

  it('enforces purpose isolation: tokens generated for one entity fail on another', () => {
    const orderCursor = protector.protect(sampleToken, 'orders');

    // Attempting to unprotect with a different purpose returns null
    const customerResult = protector.unprotect(orderCursor, 'customers');
    expect(customerResult).toBeNull();

    const invoiceResult = protector.unprotect(orderCursor, 'invoices');
    expect(invoiceResult).toBeNull();
  });

  it('resiliently handles tampered tokens without throwing exceptions', () => {
    const opaque = protector.protect(sampleToken, 'orders');

    // Tamper with the ciphertext by flipping characters
    const buf = Buffer.from(opaque, 'base64url');
    buf[buf.length - 1] = (buf[buf.length - 1]! ^ 0xff); // flip bits in payload
    const tamperedOpaque = buf.toString('base64url');

    const result = protector.unprotect(tamperedOpaque, 'orders');
    expect(result).toBeNull();
  });

  it('returns null for short, invalid, or truncated payloads', () => {
    expect(protector.unprotect('short', 'orders')).toBeNull();
    expect(protector.unprotect(null, 'orders')).toBeNull();
    expect(protector.unprotect('', 'orders')).toBeNull();
    expect(protector.unprotect('   ', 'orders')).toBeNull();
    expect(protector.unprotect('invalid-base64-payload!!!', 'orders')).toBeNull();
  });

  it('fails if protector is initialized without a secret', () => {
    expect(() => new CryptoCursorProtector('')).toThrow();
  });
});
