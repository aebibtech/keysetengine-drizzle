# Frequently Asked Questions

---

### Can the sort column contain `NULL` values?

**No.** Relational databases treat `NULL` values non-deterministically in boolean comparisons (`NULL > val` evaluates to `UNKNOWN` or `FALSE`). Keyset pagination requires deterministic, strictly-ordered boundaries.

If your column is nullable (for example, `completedAt`), either:
1. Filter out null values before paginating: `.where(isNotNull(orders.completedAt))`
2. Or use a non-null fallback column for sorting (such as `createdAt` or `id`).

---

### Can I paginate Drizzle Relational Queries (`db.query.table.findMany`)?

**Yes.** While `paginateKeyset()` targets Drizzle's dynamic select query builders (`db.select().from(table).$dynamic()`), you can use `buildKeysetClause()` and `formatKeysetPage()` with Drizzle's relational query API:

```ts
import { buildKeysetClause, formatKeysetPage } from 'keysetengine-drizzle';

// 1. Generate query components
const { where, orderBy, limit, cursorToken } = buildKeysetClause(orderKeyset, request);

// 2. Pass clauses into db.query
const rawRows = await db.query.orders.findMany({
  where,
  orderBy,
  limit,
  with: {
    items: true, // Eager load relational associations
  },
});

// 3. Format slice and edge cursors
const page = formatKeysetPage(rawRows, request, orderKeyset, cursorToken);
```

---

### How are JavaScript `Date` instances and SQL timestamps serialized?

When extracting edge values for cursor tokens, KeysetEngine automatically converts JavaScript `Date` instances into standardized **ISO 8601 strings** (`2026-10-20T08:00:00.000Z`).

When decoding cursors, KeysetEngine checks Drizzle column metadata (`column.dataType === 'date'`) and reconstructs native `Date` instances or passes ISO strings appropriately based on driver requirements.

---

### Can I use UUID strings or `BigInt` identifiers as tie-breakers?

**Yes.** KeysetEngine supports `number`, `string` (including UUIDs), and `BigInt` tie-breakers. BigInt values are converted to strings during JSON token serialization and coerced back when constructing Drizzle SQL inequality predicates.

---

### Why can't I jump directly to Page 50?

Keyset pagination is designed for **sequential streaming** (infinite scroll, continuous feeds, or Next/Previous navigation). 

Because it eliminates `OFFSET`, the database only knows how to find the next page by looking at the edge of the current page. Jumping directly to an arbitrary page requires scanning all preceding rows—which reintroduces the exact $O(N)$ performance degradation keyset pagination is designed to eliminate.
