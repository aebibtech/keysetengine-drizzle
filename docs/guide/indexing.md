# Index Design & Optimization

To achieve true $O(1)$ sub-millisecond execution times, your database tables must have appropriate composite indexes backing your keyset configuration.

---

## The Leading Column Rule

In relational B-tree indexes, the order of columns in a composite index dictates how queries can seek:

1. **Sort Column First**: The primary sort column must always be the **leading (first) column** in the composite index.
2. **Tie-Breaker Column Second**: The unique tie-breaker column (usually the primary key) must be the **second column**.

```sql
-- Optimal composite index
CREATE INDEX idx_orders_created_at_id ON orders (created_at DESC, id DESC);
```

::: danger Avoid Individual Single-Column Indexes
Two separate single-column indexes on `created_at` and `id` **will not** allow the database to perform an index seek on a composite keyset inequality. The database will be forced to perform index bitmap merging or sequential table scans.
:::

---

## Dialect-Specific Index Recipes

### 1. PostgreSQL

```sql
-- Standard Keyset B-Tree index
CREATE INDEX idx_orders_created_at_id ON orders (created_at DESC, id DESC);

-- Trigram index for ILIKE text search (requires pg_trgm extension)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_orders_customer_name_trgm ON orders USING gin (customer_name gin_trgm_ops);

-- GIN index for full-text tsvector search
CREATE INDEX idx_orders_search_vector ON orders USING gin (to_tsvector('english', description));
```

---

### 2. SQLite

```sql
-- Standard Keyset B-Tree index
CREATE INDEX idx_orders_created_at_id ON orders (created_at DESC, id DESC);
```

---

### 3. MySQL / MariaDB

```sql
-- Standard Keyset B-Tree index
CREATE INDEX idx_orders_created_at_id ON orders (created_at DESC, id DESC);

-- Full-text index for text search
ALTER TABLE orders ADD FULLTEXT INDEX idx_orders_text_search (customer_name, order_number);
```

---

## Multi-Tenant Indexing

If your application enforces tenant isolation or soft deletes, prepend those filter columns to the composite index:

```sql
-- Tenant-scoped Keyset Index
CREATE INDEX idx_orders_tenant_created_at_id ON orders (tenant_id, created_at DESC, id DESC);
```

When querying:
```ts
const baseQuery = db
  .select()
  .from(orders)
  .where(eq(orders.tenantId, currentTenantId))
  .$dynamic();

const page = await paginateKeyset(baseQuery, orderKeyset, request);
```
The database engine performs an immediate index seek using `(tenant_id, created_at, id)`, guaranteeing complete tenant isolation at optimal speed.
