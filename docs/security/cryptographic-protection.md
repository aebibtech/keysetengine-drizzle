# Cryptographic Cursor Protection

Public API cursors should never expose internal primary keys, sequential auto-incrementing IDs, or business timestamps in plain text. Exposing raw coordinates allows clients to scrape databases, infer internal entity volumes, or tamper with boundaries.

`KeysetEngine Drizzle` includes enterprise-grade authenticated encryption via `CryptoCursorProtector`.

---

## Security Architecture

```
KeysetCursorToken { sortValue, tieBreakerValue, isAscending, searchHash }
   │
   ▼
JSON Serialization
   │
   ▼
HKDF Key Derivation ──► info: "KeysetEngine:" + entityPurpose + ":v1"
   │
   ▼
AES-256-GCM Encryption
   ├── 96-bit random IV
   ├── 128-bit Authentication Tag
   └── Additional Authenticated Data (AAD) bound to entityPurpose
   │
   ▼
URL-Safe Base64 Encoding
   └── [IV (12B)] + [Tag (16B)] + [Ciphertext]
```

---

## Production Setup: `CryptoCursorProtector`

`CryptoCursorProtector` uses native `node:crypto` (available in both Node.js 18+ and Bun with zero external dependencies) to provide authenticated encryption (AES-256-GCM) with purpose-specific key derivation.

```ts
import { CryptoCursorProtector } from 'keysetengine-drizzle';

// Initialize with a secure, 32-byte or high-entropy master secret
export const cursorProtector = new CryptoCursorProtector(
  process.env.CURSOR_ENCRYPTION_SECRET!
);
```

---

## Endpoint & Purpose Isolation

To prevent cursor tokens issued for one endpoint from being reused on another, KeysetEngine uses **HKDF purpose isolation**.

When a token is encrypted:
```ts
protector.protect(token, 'orders');
```
The master secret is derived with HKDF using the context string `KeysetEngine:orders:v1`.

If an attacker captures an opaque cursor from `/api/orders` and attempts to submit it to `/api/customers`:
```ts
protector.unprotect(orderCursor, 'customers'); // Returns null!
```
The authentication tag verification fails immediately, and KeysetEngine returns `null`, safely falling back to Page 1 of `/api/customers`.

---

## Resilient Tamper Detection

If a client modifies, truncates, or corrupts an opaque cursor string:
1. `CryptoCursorProtector` catches the AES-GCM authentication failure or base64 decoding error.
2. It returns `null` instead of raising an unhandled exception.
3. `paginateKeyset()` treats the invalid cursor as an initial query and returns **Page 1**, preventing application crashes or 500 server errors.

---

## Development Fallback: `Base64UrlCursorProtector`

For local unit testing or development where secret keys are not configured, `Base64UrlCursorProtector` provides zero-secret Base64URL JSON encoding:

```ts
import { Base64UrlCursorProtector } from 'keysetengine-drizzle';

const devProtector = new Base64UrlCursorProtector();
```

::: warning Development Use Only
`Base64UrlCursorProtector` does not encrypt boundary coordinates and should not be used in production environments.
:::
