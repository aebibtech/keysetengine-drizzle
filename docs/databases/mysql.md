# MySQL / MariaDB Adapter

MySQL and MariaDB are supported out-of-the-box via KeysetEngine's universal nested boolean disjunctions and collation-aware LIKE expressions.

---

## Drizzle Schema Definition

```ts
import { mysqlTable, serial, varchar, datetime, int } from 'drizzle-orm/mysql-core';

export const orders = mysqlTable('orders', {
  id: serial('id').primaryKey(),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  orderNumber: varchar('order_number', { length: 64 }).notNull(),
  createdAt: datetime('created_at').notNull(),
  amount: int('amount').notNull(),
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
  searchStrategy: 'like',
  entityPurpose: 'orders',
});
```

---

## Collation Nuances

By default, standard MySQL string collations (such as `utf8mb4_0900_ai_ci` or `utf8mb4_general_ci`) are **case-insensitive** and **accent-insensitive**. 

The default `'like'` strategy in KeysetEngine emits `lower(col) LIKE lower('%term%')`, which guarantees case-insensitive evaluation regardless of whether your MySQL table uses a binary or case-sensitive collation.

---

## Recommended MySQL Indexes

```sql
-- Composite B-Tree for O(1) Keyset seek
CREATE INDEX idx_orders_created_at_id ON orders (created_at DESC, id DESC);

-- Optional Fulltext index for high-volume text columns
ALTER TABLE orders ADD FULLTEXT INDEX idx_orders_text_search (customer_name, order_number);
```
