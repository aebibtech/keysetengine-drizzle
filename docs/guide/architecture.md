# Architecture & SQL Expressions

This document details the mathematical formulation, expression tree compilation, and execution pipeline of **KeysetEngine Drizzle**.

---

## End-to-End Execution Pipeline

```
Incoming Request (cursor, direction, limit, search)
   │
   ▼
1. Validate & Hash Search Term ───► Invalidate cursor if search changed
   │
   ▼
2. Unprotect Edge Cursor ────────► AES-256-GCM / HKDF Purpose Isolation
   │
   ▼
3. Construct SQL Predicates:
   ├── Search Predicate:     or(strategy(col1, term), strategy(col2, term))
   └── Keyset Boundary:      (SortCol > val) OR (SortCol = val AND Tie > tieVal)
   │
   ▼
4. Drizzle Execution:
   ├── Append filters to existing query without overwriting (.where)
   ├── Invert ORDER BY if navigating backward
   └── Fetch Limit + 1 rows
   │
   ▼
5. Envelope Processing:
   ├── Evaluate N + 1 item to determine hasNextPage / hasPreviousPage
   ├── In-memory array reversal if navigating backward
   └── Encrypt new edge cursors (startCursor, endCursor)
   │
   ▼
Return KeysetPage<T>
```

---

## Why Nested Boolean Trees Instead of Tuples?

Some database engines (PostgreSQL, SQLite) support SQL row-value syntax:
```sql
WHERE ("created_at", "id") < ('2026-10-20', 42)
```

However:
1. **SQL Server and older engines** do not support row-value tuple comparisons.
2. ORM SQL generators and driver query planners do not uniformly optimize tuple syntax across database providers.

By formulating keyset boundaries as **nested boolean disjunctions**, KeysetEngine generates identical, index-seekable SQL across all database dialects:

$$\text{Forward Ascending} = (Key_A > val_A) \lor (Key_A == val_A \land Key_B > val_B)$$
$$\text{Forward Descending} = (Key_A < val_A) \lor (Key_A == val_A \land Key_B < val_B)$$

---

## Inequality Direction Truth Table

KeysetEngine automatically determines the effective inequality comparison operator based on sort direction and requested navigation direction:

| Sort Config | Navigation Direction | Primary Comparison | Tie-Breaker Comparison | Effective Direction |
| :--- | :--- | :--- | :--- | :--- |
| **Ascending** | `forward` | `SortCol > val` | `TieCol > tieVal` | Greater Than (`>`) |
| **Ascending** | `backward` | `SortCol < val` | `TieCol < tieVal` | Less Than (`<`) |
| **Descending** | `forward` | `SortCol < val` | `TieCol < tieVal` | Less Than (`<`) |
| **Descending** | `backward` | `SortCol > val` | `TieCol > tieVal` | Greater Than (`>`) |

---

## Safe Drizzle `$dynamic()` Composition

In Drizzle ORM, calling `.where()` on a query builder normally overwrites any previously applied where clause.

KeysetEngine checks whether your query already contains existing filters (such as tenant isolation, organization filters, or soft-delete checks) and safely combines them using `and()`:

```ts
// User query with existing business filters
const baseQuery = db
  .select()
  .from(orders)
  .where(eq(orders.status, 'completed'))
  .$dynamic();

// paginateKeyset safely combines filters into:
// WHERE ("status" = 'completed') AND (("created_at" < $1) OR (...))
const page = await paginateKeyset(baseQuery, orderKeyset, request);
```

---

## $N + 1$ Slicing & Edge Cursors

To determine whether subsequent or preceding pages exist without executing a slow `COUNT(*)` query, KeysetEngine requests `limit + 1` rows:

1. **Slice Inspection**: If `rows.length > limit`, a further page exists in the traversal direction.
2. **Item Truncation**: The extra $(N+1)$-th row is removed from the array before returning.
3. **Cursor Minting**: The first row's coordinates are encrypted into `startCursor`, and the last row's coordinates into `endCursor`.
