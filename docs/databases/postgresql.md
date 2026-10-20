# PostgreSQL Adapter

PostgreSQL is a first-class target for KeysetEngine Drizzle, offering native support for composite B-tree index seeks, case-insensitive `ILIKE` pattern matching, and full-text `tsvector` queries.

---

## Drizzle Schema Definition

```ts
import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  orderNumber: text('order_number').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').notNull(),
  amount: integer('amount').notNull(),
});
```

---

## Keyset Configuration

```ts
import { createKeysetConfig } from 'keysetengine-drizzle';
import { orders } from './schema.js';

export const orderKeyset = createKeysetConfig(orders, {
  sortBy: orders.createdAt,
  sortDirection: 'desc',
  tieBreaker: orders.id,
  searchIn: [orders.customerName, orders.orderNumber],
  searchStrategy: 'ilike', // Uses PostgreSQL ILIKE
  entityPurpose: 'orders',
});
```

---

## Full-Text Search with `tsvector`

For advanced full-text search across large text columns, use the built-in `postgresTsVectorSearchStrategy`:

```ts
import {
  createKeysetConfig,
  postgresTsVectorSearchStrategy,
} from 'keysetengine-drizzle';
import { orders } from './schema.js';

export const orderKeyset = createKeysetConfig(orders, {
  sortBy: orders.createdAt,
  sortDirection: 'desc',
  tieBreaker: orders.id,
  searchIn: [orders.description],
  searchStrategy: postgresTsVectorSearchStrategy('english'),
  entityPurpose: 'orders',
});
```

This compiles into:
```sql
WHERE to_tsvector('english', "description") @@ plainto_tsquery('english', $1)
  AND (("created_at" < $2) OR ("created_at" = $2 AND "id" < $3))
ORDER BY "created_at" DESC, "id" DESC
LIMIT 21;
```

---

## Recommended PostgreSQL Indexes

```sql
-- 1. Composite B-Tree for O(1) Keyset Navigation
CREATE INDEX idx_orders_created_at_id ON orders (created_at DESC, id DESC);

-- 2. Trigram Index for Fast ILIKE Text Search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_orders_customer_trgm ON orders USING gin (customer_name gin_trgm_ops);

-- 3. GIN Index for Full-Text tsvector Search
CREATE INDEX idx_orders_tsvector ON orders USING gin (to_tsvector('english', description));
```
