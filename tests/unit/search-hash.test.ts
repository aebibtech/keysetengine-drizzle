import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { computeSearchHash, matchesSearchHash } from '../../src/crypto/search-hash.js';

describe('SearchHashUtility', () => {
  it('returns null for null, undefined, empty, or whitespace-only inputs', () => {
    expect(computeSearchHash(null)).toBeNull();
    expect(computeSearchHash(undefined)).toBeNull();
    expect(computeSearchHash('')).toBeNull();
    expect(computeSearchHash('   ')).toBeNull();
    expect(computeSearchHash('\t\n ')).toBeNull();
  });

  it('computes 16-character lowercase hex digest matching SHA-256 8 bytes', () => {
    const term = 'Quantum Dynamics';
    const expected = createHash('sha256')
      .update(term)
      .digest('hex')
      .slice(0, 16)
      .toLowerCase();

    const actual = computeSearchHash(term);
    expect(actual).toBe(expected);
    expect(actual).toHaveLength(16);
  });

  it('normalizes search terms by trimming leading and trailing whitespace', () => {
    const raw = '   Quantum Dynamics   \t';
    const trimmed = 'Quantum Dynamics';

    expect(computeSearchHash(raw)).toBe(computeSearchHash(trimmed));
  });

  it('matchesSearchHash correctly identifies matching and mismatching hashes', () => {
    const term1 = 'electronics';
    const term2 = 'clothing';
    const hash1 = computeSearchHash(term1);

    expect(matchesSearchHash(term1, hash1)).toBe(true);
    expect(matchesSearchHash('  electronics  ', hash1)).toBe(true);
    expect(matchesSearchHash(term2, hash1)).toBe(false);
    expect(matchesSearchHash(null, hash1)).toBe(false);
    expect(matchesSearchHash(null, null)).toBe(true);
    expect(matchesSearchHash('something', null)).toBe(false);
  });
});
