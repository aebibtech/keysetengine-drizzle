# SQLite & In-Memory Adapter

SQLite is fully supported by KeysetEngine Drizzle, running at blazing speed both in production embedded apps and in-memory test suites using `bun:sqlite` or `better-sqlite3`.

---

## Drizzle Schema Definition

```ts
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  orderNumber: text('order_number').notNull(),
  createdAt: text('created_at').notNull(), // ISO 8601 string or integer timestamp
  amount: integer('amount').notNull(),
});
```

---

## Keyset Configuration

In SQLite, use the default `'like'` search strategy, which emits `lower(column) LIKE lower('%term%')` for case-insensitive text matching:

```ts
import { createKeysetConfig } from 'keysetengine-drizzle';
import { orders } from './schema.js';

export const orderKeyset = createKeysetConfig(orders, {
  sortBy: orders.createdAt,
  sortDirection: 'asc',
  tieBreaker: orders.id,
  searchIn: [orders.customerName, orders.orderNumber],
  searchStrategy: 'like', // Universal lower(col) LIKE lower(term)
  entityPurpose: 'orders',
});
```

---

## Driver Setup Examples

::: code-group

```ts [Bun (bun:sqlite)]
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';

const sqlite = new Database('app.db');
export const db = drizzle(sqlite);
```

```ts [Node.js (better-sqlite3)]
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const sqlite = new Database('app.db');
export const db = drizzle(sqlite);
```

:::

---

## Recommended SQLite Indexes

```sql
-- Composite B-tree for O(1) Keyset seek
CREATE INDEX idx_orders_created_at_id ON orders (created_at, id);
```
