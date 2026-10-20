# KeysetEngine for Drizzle ORM

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Runtime](https://img.shields.io/badge/Runtime-Node.js%20%7C%20Bun-green.svg)](https://bun.sh)
[![ORM](https://img.shields.io/badge/ORM-Drizzle%20ORM-orange.svg)](https://orm.drizzle.team)

High-performance, database-agnostic keyset pagination and universal search library for **Drizzle ORM** on **Node.js (18+) and Bun**.

Direct TypeScript port of the [.NET KeysetEngine](https://github.com/aebibtech/keysetengine), preserving all core mathematical guarantees, bidirectional navigation, and cryptographic token security.

---

## Why Keyset Pagination?

Keyset pagination eliminates the severe $O(N)$ query degradation inherent to SQL `OFFSET` on large datasets by establishing stable, indexed boundaries using composite keys and opaque cursors:

- **True $O(1)$ Keyset Pagination**: No slow `OFFSET` scans; uses nested boolean comparison trees compatible with PostgreSQL, SQLite, and MySQL.
- **Bidirectional Traversal**: Seamless forward and backward page navigation with automated in-memory ordering reversal.
- **Tamper-Proof Opaque Cursors**: Cryptographic protection via authenticated encryption (AES-256-GCM via `node:crypto`) with purpose and entity isolation.
- **Dynamic Multi-Column Search**: Search across multiple properties without breaking keyset boundaries or client-side evaluation.
- **Zero External Runtime Dependencies**: Uses native `node:crypto` and peer-depends strictly on `drizzle-orm`.

---

## Installation

```bash
# Using bun
bun add keysetengine-drizzle drizzle-orm

# Using pnpm
pnpm add keysetengine-drizzle drizzle-orm

# Using npm
npm install keysetengine-drizzle drizzle-orm
```

---

## Quickstart

### 1. Define Drizzle Table

```ts
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
// Or pgTable from 'drizzle-orm/pg-core'

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  orderNumber: text('order_number').notNull(),
  createdAt: text('created_at').notNull(),
  amount: integer('amount').notNull(),
});
```

### 2. Configure Keyset Boundaries

```ts
import { createKeysetConfig } from 'keysetengine-drizzle';
import { orders } from './schema.js';

export const orderKeyset = createKeysetConfig(orders, {
  sortBy: orders.createdAt,
  sortDirection: 'desc', // default 'asc'
  tieBreaker: orders.id,  // Must be unique and non-nullable
  searchIn: [orders.customerName, orders.orderNumber],
  entityPurpose: 'orders',
});
```

### 3. Query Paginated Data

```ts
import { paginateKeyset, CryptoCursorProtector } from 'keysetengine-drizzle';
import { db } from './db.js';
import { orderKeyset } from './keyset.js';

// Production cryptographic protector (AES-256-GCM + HKDF)
const protector = new CryptoCursorProtector(process.env.CURSOR_ENCRYPTION_SECRET!);

// In your route handler (Express, Hono, Elysia, Fastify, Next.js):
export async function getOrders(req) {
  const { cursor, direction, limit, search } = req.query;

  const page = await paginateKeyset(
    db.select().from(orders).$dynamic(),
    orderKeyset,
    {
      cursor,
      direction: direction === 'backward' ? 'backward' : 'forward',
      limit: Number(limit) || 20,
      search,
    },
    { protector }
  );

  return {
    items: page.items,
    startCursor: page.startCursor,
    endCursor: page.endCursor,
    hasNextPage: page.hasNextPage,
    hasPreviousPage: page.hasPreviousPage,
  };
}
```

---

## Search Strategies

KeysetEngine includes multiple search strategies:

1. **Universal Strategy (Default)**:
   ```ts
   searchStrategy: 'like' // lower(column) LIKE lower('%term%')
   ```
2. **PostgreSQL Strategy**:
   ```ts
   searchStrategy: 'ilike' // ILIKE '%term%'
   ```
3. **PostgreSQL TsVector (Full-Text Search)**:
   ```ts
   searchStrategy: 'tsvector' // to_tsvector @@ plainto_tsquery
   ```
4. **Custom Expression Strategy**:
   ```ts
   import { sql } from 'drizzle-orm';

   createKeysetConfig(orders, {
     // ...
     searchStrategy: (column, term) => sql`${column} LIKE ${'%' + term + '%'}`,
   });
   ```

---

## Cryptographic Security & Purpose Isolation

`CryptoCursorProtector` implements authenticated encryption with purpose-scoped keys:
- **AES-256-GCM**: Authenticated payload encryption ensures cursors cannot be read or tampered with by clients.
- **HKDF Purpose Isolation**: Tokens generated for an `'orders'` endpoint cannot be decrypted or accepted by a `'customers'` endpoint.
- **Graceful Fault Tolerance**: Corrupt, expired, or tampered tokens safely evaluate to `null` and return the first page instead of raising 500 errors.

---

## License

MIT © [Paul Camano — StewardAxis LLC](mailto:paul@aebibtech.com)
