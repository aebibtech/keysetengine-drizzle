import { createHash } from 'node:crypto';

/**
 * Computes a deterministic compact hash of a search term.
 * Produces an 8-byte (16 hex character) lowercase SHA-256 digest of the trimmed search string,
 * offering 100% byte-for-byte parity with .NET KeysetEngine's SearchHashUtility.
 *
 * @param search The active search string.
 * @returns 16-character hex string, or null if empty/whitespace.
 */
export function computeSearchHash(search?: string | null): string | null {
  if (!search) {
    return null;
  }
  const trimmed = search.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return createHash('sha256')
    .update(trimmed, 'utf8')
    .digest('hex')
    .slice(0, 16)
    .toLowerCase();
}

/**
 * Validates whether the active search term matches the expected cursor search hash.
 * If the search parameter changed since the cursor was issued, this returns false to signal
 * stale cursor invalidation.
 *
 * @param search The active search term.
 * @param expectedHash The search hash recorded in the cursor token.
 */
export function matchesSearchHash(
  search?: string | null,
  expectedHash?: string | null
): boolean {
  const activeHash = computeSearchHash(search);
  if (!activeHash && !expectedHash) {
    return true;
  }
  if (!activeHash || !expectedHash) {
    return false;
  }
  return activeHash.toLowerCase() === expectedHash.toLowerCase();
}
