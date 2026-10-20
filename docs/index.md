---
layout: home

hero:
  name: KeysetEngine Drizzle
  text: High-Performance Keyset Pagination & Search
  tagline: Database-agnostic, zero-degradation pagination with cryptographic cursors for Drizzle ORM on Node.js and Bun.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Why Keyset?
      link: /guide/why-keyset
    - theme: alt
      text: GitHub
      link: https://github.com/aebibtech/keysetengine-drizzle

features:
  - icon: ⚡
    title: True O(1) Performance
    details: Eliminates SQL OFFSET execution degradation on deep datasets by establishing stable indexed boundaries using composite keys.
  - icon: 🔄
    title: Bidirectional Traversal
    details: Seamless forward and backward page navigation with automated SQL ordering reversal and in-memory sequence restoration.
  - icon: 🔒
    title: Cryptographic Opaque Cursors
    details: Authenticated encryption (AES-256-GCM + HKDF) via native node:crypto provides tamper-proof tokens with purpose isolation.
  - icon: 🔍
    title: Universal Dynamic Search
    details: Compose multi-column search predicates with SHA-256 search-signature hashing that automatically resets stale cursors.
  - icon: 🗄️
    title: Native Drizzle Integration
    details: First-class integration with Drizzle ORM select query builders across PostgreSQL, SQLite, and MySQL.
  - icon: 📦
    title: Zero Runtime Dependencies
    details: Highly lightweight with zero external runtime packages beyond native node:crypto and drizzle-orm.
---

## Quick Look

```ts
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { createKeysetConfig, paginateKeyset, CryptoCursorProtector } from 'keysetengine-drizzle';

// 1. Define your Drizzle table
export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  orderNumber: text('order_number').notNull(),
  createdAt: text('created_at').notNull(),
  amount: integer('amount').notNull(),
});

// 2. Configure keyset boundary & search properties
export const orderKeyset = createKeysetConfig(orders, {
  sortBy: orders.createdAt,
  sortDirection: 'desc', // Default is 'asc'
  tieBreaker: orders.id,  // Must be unique and non-nullable
  searchIn: [orders.customerName, orders.orderNumber],
  entityPurpose: 'orders',
});

// 3. Paginate in your HTTP route handler (Hono, Express, Elysia, Fastify, Next.js)
const protector = new CryptoCursorProtector(process.env.CURSOR_SECRET!);

export async function getOrders(req) {
  const page = await paginateKeyset(
    db.select().from(orders).$dynamic(),
    orderKeyset,
    req.query, // { cursor, direction, limit, search }
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

::: tip High Throughput at Deep Offsets
Unlike standard SQL `OFFSET 100000 LIMIT 20` which forces your database engine to scan and discard 100,000 index entries, `KeysetEngine` translates queries directly into composite index seeks:
```sql
WHERE ("created_at" < $1) OR ("created_at" = $1 AND "id" < $2)
ORDER BY "created_at" DESC, "id" DESC
LIMIT 21
```
Execution time remains consistently **under 1 millisecond**, regardless of table size or page depth.
:::
