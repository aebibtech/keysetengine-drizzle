# Security API Reference

This module covers cursor serialization, authenticated encryption, and search signature hashing.

---

## `CursorProtector`

Contract implemented by all cursor protectors:

```ts
interface CursorProtector {
  protect(token: KeysetCursorToken, entityPurpose: string): string;
  unprotect(opaqueCursor: string | null | undefined, entityPurpose: string): KeysetCursorToken | null;
}
```

---

## `CryptoCursorProtector`

Production-grade authenticated encryption using native `node:crypto` (AES-256-GCM + HKDF).

```ts
class CryptoCursorProtector implements CursorProtector {
  constructor(options: CryptoCursorProtectorOptions | string);
  protect(token: KeysetCursorToken, entityPurpose: string): string;
  unprotect(opaqueCursor: string | null | undefined, entityPurpose: string): KeysetCursorToken | null;
}
```

### Options
```ts
interface CryptoCursorProtectorOptions {
  secret: string | Buffer;
  salt?: string | Buffer;
}
```

### Methods
- **`protect(token, entityPurpose)`**: Derives a purpose-isolated 256-bit key via HKDF, encrypts the serialized JSON payload with AES-256-GCM, and returns a URL-safe Base64 string containing the IV, Auth Tag, and Ciphertext.
- **`unprotect(opaqueCursor, entityPurpose)`**: Validates the authentication tag, decrypts the ciphertext, and returns the deserialized `KeysetCursorToken`. Returns `null` if the cursor is missing, corrupt, expired, tampered, or encrypted for a different `entityPurpose`.

---

## `Base64UrlCursorProtector`

Zero-dependency URL-safe Base64 serializer intended for local development and unit testing.

```ts
class Base64UrlCursorProtector implements CursorProtector {
  protect(token: KeysetCursorToken, entityPurpose: string): string;
  unprotect(opaqueCursor: string | null | undefined, entityPurpose: string): KeysetCursorToken | null;
}
```

---

## Search Hash Utilities

### `computeSearchHash(search?)`
Computes an 8-byte (16 hex character) lowercase SHA-256 digest of the trimmed search string. Returns `null` if the input is null, undefined, empty, or whitespace.

```ts
function computeSearchHash(search?: string | null): string | null
```

### `matchesSearchHash(search?, expectedHash?)`
Validates whether the active search term matches the search hash recorded inside a cursor token. Returns `false` if the search filter has changed, signaling stale cursor invalidation.

```ts
function matchesSearchHash(search?: string | null, expectedHash?: string | null): boolean
```
