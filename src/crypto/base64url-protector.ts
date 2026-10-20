import type { CursorProtector, KeysetCursorToken } from '../types.js';

/**
 * Fallback, zero-secret URL-safe Base64 cursor serializer.
 * Intended for development and unit testing without cryptographic provider setup.
 * Safely catches decoding and JSON formatting exceptions, returning null.
 */
export class Base64UrlCursorProtector implements CursorProtector {
  /**
   * Serializes the token to a URL-safe Base64 JSON string.
   */
  public protect(token: KeysetCursorToken, _entityPurpose: string): string {
    if (!token) {
      throw new Error('Token must not be null or undefined.');
    }
    const json = JSON.stringify(token);
    return Buffer.from(json, 'utf8').toString('base64url');
  }

  /**
   * Deserializes a URL-safe Base64 encoded JSON string into a KeysetCursorToken.
   * Returns null if missing, malformed, or invalid JSON.
   */
  public unprotect(
    opaqueCursor: string | null | undefined,
    _entityPurpose: string
  ): KeysetCursorToken | null {
    if (!opaqueCursor || typeof opaqueCursor !== 'string') {
      return null;
    }
    const trimmed = opaqueCursor.trim();
    if (trimmed.length === 0) {
      return null;
    }

    try {
      const json = Buffer.from(trimmed, 'base64url').toString('utf8');
      const parsed = JSON.parse(json) as Partial<KeysetCursorToken>;

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('sortValue' in parsed) ||
        !('tieBreakerValue' in parsed) ||
        typeof parsed.isAscending !== 'boolean'
      ) {
        return null;
      }

      return {
        sortValue: parsed.sortValue,
        tieBreakerValue: parsed.tieBreakerValue,
        isAscending: parsed.isAscending,
        searchHash: typeof parsed.searchHash === 'string' ? parsed.searchHash : null,
      };
    } catch {
      // Graceful fallback for corrupted/tampered payloads
      return null;
    }
  }
}
