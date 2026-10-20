# Dynamic Search & Stale Cursors

KeysetEngine provides dynamic multi-column search capabilities that integrate seamlessly with keyset boundaries without triggering table scans or memory-intensive post-filtering.

---

## Configuring Search Columns

When defining your keyset configuration with `createKeysetConfig`, specify the string columns to search using the `searchIn` option:

```ts
export const orderKeyset = createKeysetConfig(orders, {
  sortBy: orders.createdAt,
  tieBreaker: orders.id,
  searchIn: [orders.customerName, orders.orderNumber, orders.notes],
  searchStrategy: 'ilike', // or 'like', 'tsvector'
});
```

When a search term is submitted (`request.search = "Quantum"`), KeysetEngine compiles a disjunctive predicate across all configured columns:

```sql
WHERE ("customer_name" ILIKE '%Quantum%' OR "order_number" ILIKE '%Quantum%' OR "notes" ILIKE '%Quantum%')
  AND (("created_at" < $1) OR ("created_at" = $1 AND "id" < $2))
```

---

## The Stale Cursor Problem

In cursor-based pagination, cursors encode the coordinates of specific boundary records. However, when user search filters change between requests, retaining the previous cursor leads to incorrect or broken results:

1. User queries `search = "Shoes"`, viewing Page 1.
2. User receives an `endCursor` pointing to the coordinates of a shoe item.
3. User changes their search input to `search = "Electronics"`, but the client frontend inadvertently resubmits the shoe cursor from Page 1.
4. Without protection, the database would seek forward from the shoe's coordinates, skipping relevant electronic items or returning empty pages.

---

## Automated Stale Cursor Invalidation

KeysetEngine prevents this issue via **Search-Signature Hashing**:

1. **Hash Generation**: Whenever a search query is active, KeysetEngine computes a compact, deterministic SHA-256 hash (16 hexadecimal characters) of the trimmed search term:
   ```ts
   import { computeSearchHash } from 'keysetengine-drizzle';

   const hash = computeSearchHash('Quantum Dynamics'); // "5e884898da280471"
   ```
2. **Token Binding**: The hash is embedded into the encrypted cursor token payload.
3. **Validation on Arrival**: When a cursor is received, KeysetEngine compares the hash of the active search string with the hash stored inside the cursor token.
4. **Graceful Page 1 Reset**: If the hashes do not match, KeysetEngine invalidates the stale cursor and safely restarts the query from **Page 1** under the new search context, preventing 500 errors or corrupted query boundaries.
