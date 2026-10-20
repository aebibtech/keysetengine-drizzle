# Getting Started

`KeysetEngine Drizzle` is a high-performance, database-agnostic keyset pagination and universal search library for **Drizzle ORM** on **Node.js (18+) and Bun**.

It eliminates SQL `OFFSET` latency degradation by establishing stable, indexed boundaries using composite keys and opaque cryptographic cursors.

---

## Installation

Install `keysetengine-drizzle` alongside `drizzle-orm` using your package manager of choice:

::: code-group

```bash [bun]
bun add keysetengine-drizzle drizzle-orm
```

```bash [pnpm]
pnpm add keysetengine-drizzle drizzle-orm
```

```bash [npm]
npm install keysetengine-drizzle drizzle-orm
```

:::

### Peer Dependencies
- **`drizzle-orm`**: `>= 0.35.0`
- **Node.js**: `^18.0.0 || ^20.0.0 || ^22.0.0 || ^24.0.0`
- **Bun**: `>= 1.0.0`

---

## Core Setup in 4 Steps

### Step 1: Define Your Table Schema

Define your database schema using standard Drizzle table builders (`pgTable`, `sqliteTable`, or `mysqlTable`).

```ts
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  orderNumber: text('order_number').notNull(),
  createdAt: text('created_at').notNull(),
  amount: integer('amount').notNull(),
});
```

::: warning Deterministic Keyset Requirement
The **tie-breaker column** (typically your primary key) and the **sort column** must both be **non-nullable** and deterministically ordered.
:::

---

### Step 2: Configure the Keyset Boundary

Use `createKeysetConfig()` to declare how the entity is ordered, tie-broken, and searched.

```ts
import { createKeysetConfig } from 'keysetengine-drizzle';
import { orders } from './schema.js';

export const orderKeyset = createKeysetConfig(orders, {
  // Primary sort column
  sortBy: orders.createdAt,
  sortDirection: 'desc', // 'asc' or 'desc' (default: 'asc')

  // Deterministic tie-breaker
  tieBreaker: orders.id,

  // Text search target columns
  searchIn: [orders.customerName, orders.orderNumber],

  // Purpose string for cursor token isolation
  entityPurpose: 'orders',
});
```

---

### Step 3: Paginate Your Drizzle Query

Pass your dynamic Drizzle query (`$dynamic()`), the keyset config, and incoming request parameters to `paginateKeyset()`:

```ts
import { paginateKeyset, CryptoCursorProtector } from 'keysetengine-drizzle';
import { db } from './db.js';
import { orders } from './schema.js';
import { orderKeyset } from './keyset.js';

// Setup cryptographic protector with master secret
const protector = new CryptoCursorProtector(process.env.CURSOR_ENCRYPTION_SECRET!);

export async function handleGetOrders(requestQuery: Record<string, string | undefined>) {
  const page = await paginateKeyset(
    db.select().from(orders).$dynamic(),
    orderKeyset,
    {
      cursor: requestQuery.cursor,
      direction: requestQuery.direction === 'backward' ? 'backward' : 'forward',
      limit: Number(requestQuery.limit) || 20,
      search: requestQuery.search,
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

### Step 4: Add Composite B-Tree Index

To guarantee true $O(1)$ query execution, create a composite B-tree index matching your sort column and tie-breaker:

```sql
CREATE INDEX idx_orders_created_at_id ON orders (created_at DESC, id DESC);
```

---

## Complete Route Example (Hono & Bun)

```ts
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { paginateKeyset, CryptoCursorProtector } from 'keysetengine-drizzle';
import { orders, orderKeyset } from './orders.js';

const app = new Hono();
const db = drizzle(new Database('app.db'));
const protector = new CryptoCursorProtector(process.env.CURSOR_SECRET || 'dev-secret-32b');

app.get('/api/orders', async (c) => {
  const query = c.req.query();

  const page = await paginateKeyset(
    db.select().from(orders).$dynamic(),
    orderKeyset,
    {
      cursor: query.cursor,
      direction: query.direction === 'backward' ? 'backward' : 'forward',
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      search: query.search,
    },
    { protector }
  );

  return c.json(page);
});

export default app;
```
