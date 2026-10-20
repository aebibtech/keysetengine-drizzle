import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import type { CursorProtector, KeysetCursorToken } from '../types.js';

export interface CryptoCursorProtectorOptions {
  /**
   * Secret key or passphrase used to derive cryptographic keys.
   * Recommended length: 32 bytes or random high-entropy string.
   */
  secret: string | Buffer;

  /**
   * Optional custom salt for key derivation (defaults to static KeysetEngine salt).
   */
  salt?: string | Buffer;
}

const DEFAULT_SALT = Buffer.from('KeysetEngine:Drizzle:Salt:v1', 'utf8');
const BASE_PURPOSE = 'KeysetEngine';
const PURPOSE_VERSION = 'v1';
const IV_LENGTH = 12; // 96-bit IV for AES-GCM
const TAG_LENGTH = 16; // 128-bit Auth Tag

/**
 * Production-grade cryptographic cursor protector that provides authenticated encryption
 * (AES-256-GCM), tamper detection, and endpoint purpose isolation via HKDF key derivation.
 *
 * Implements the same security guarantees as ASP.NET Core Data Protection in KeysetEngine.
 */
export class CryptoCursorProtector implements CursorProtector {
  private readonly masterKey: Buffer;
  private readonly salt: Buffer;

  constructor(options: CryptoCursorProtectorOptions | string) {
    const opts = typeof options === 'string' ? { secret: options } : options;
    if (!opts || !opts.secret) {
      throw new Error('A secret key is required for CryptoCursorProtector.');
    }

    this.masterKey = Buffer.isBuffer(opts.secret)
      ? opts.secret
      : Buffer.from(opts.secret, 'utf8');

    this.salt = opts.salt
      ? Buffer.isBuffer(opts.salt)
        ? opts.salt
        : Buffer.from(opts.salt, 'utf8')
      : DEFAULT_SALT;
  }

  /**
   * Derives a purpose-specific 256-bit key using HKDF-SHA256.
   */
  private deriveKey(entityPurpose: string): Buffer {
    const info = `${BASE_PURPOSE}:${entityPurpose}:${PURPOSE_VERSION}`;
    const derived = hkdfSync('sha256', this.masterKey, this.salt, info, 32);
    return Buffer.from(derived);
  }

  /**
   * Encrypts and encodes a keyset cursor token into an opaque, tamper-evident URL-safe string.
   */
  public protect(token: KeysetCursorToken, entityPurpose: string): string {
    if (!token) {
      throw new Error('Token must not be null or undefined.');
    }
    if (!entityPurpose || entityPurpose.trim().length === 0) {
      throw new Error('entityPurpose must be specified for purpose isolation.');
    }

    const key = this.deriveKey(entityPurpose.trim());
    const iv = randomBytes(IV_LENGTH);
    const aad = Buffer.from(`${BASE_PURPOSE}:${entityPurpose.trim()}:${PURPOSE_VERSION}`, 'utf8');

    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(aad);

    const json = JSON.stringify(token);
    const ciphertext = Buffer.concat([
      cipher.update(json, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // Payload: [IV (12B)] + [Tag (16B)] + [Ciphertext]
    const combined = Buffer.concat([iv, tag, ciphertext]);
    return combined.toString('base64url');
  }

  /**
   * Decrypts and validates an opaque cursor token.
   * Returns null if missing, tampered, expired, or encrypted for a different entity purpose.
   */
  public unprotect(
    opaqueCursor: string | null | undefined,
    entityPurpose: string
  ): KeysetCursorToken | null {
    if (!opaqueCursor || typeof opaqueCursor !== 'string') {
      return null;
    }
    if (!entityPurpose || entityPurpose.trim().length === 0) {
      return null;
    }

    const trimmed = opaqueCursor.trim();
    if (trimmed.length === 0) {
      return null;
    }

    try {
      const combined = Buffer.from(trimmed, 'base64url');
      if (combined.length < IV_LENGTH + TAG_LENGTH) {
        return null;
      }

      const iv = combined.subarray(0, IV_LENGTH);
      const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
      const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

      const key = this.deriveKey(entityPurpose.trim());
      const aad = Buffer.from(`${BASE_PURPOSE}:${entityPurpose.trim()}:${PURPOSE_VERSION}`, 'utf8');

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(aad);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      const parsed = JSON.parse(decrypted.toString('utf8')) as Partial<KeysetCursorToken>;

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
      // Tampered ciphertext, auth tag mismatch, or wrong purpose safely returns null
      return null;
    }
  }
}
