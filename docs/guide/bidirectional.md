# Bidirectional Traversal

KeysetEngine provides full bidirectional traversal, allowing clients to navigate seamlessly both **forward (Next Page)** and **backward (Previous Page)** through ordered datasets.

---

## How Bidirectional Navigation Works

```
                     ┌───────────────┐
                     │    Page 1     │
                     │ Items 1 .. 20 │
                     └───────┬───────┘
                             │ endCursor (direction: forward)
                             ▼
                     ┌───────────────┐
                     │    Page 2     │
                     │ Items 21 .. 40│
                     └───────┬───────┘
                             │ endCursor (direction: forward)
                             ▼
                     ┌───────────────┐
                     │    Page 3     │
                     │ Items 41 .. 60│
                     └───────┬───────┘
                             │ startCursor (direction: backward)
                             ▼
                     ┌───────────────┐
                     │    Page 2     │ (Restored into natural order 21 .. 40)
                     │ Items 21 .. 40│
                     └───────────────┘
```

---

## The Ordering Paradox & SQL Inversion

When moving backward from the start of Page 3 (say, item with ID 41), you cannot simply execute:
```sql
-- INCORRECT: This returns items 1 to 20 instead of items 21 to 40!
WHERE id < 41
ORDER BY id ASC
LIMIT 20;
```
Executing this query would return items starting from the beginning of the table (`1 .. 20`), rather than the immediate previous slice (`21 .. 40`).

### The Two-Step Reversal Solution

KeysetEngine solves this transparently in two steps:

1. **SQL Order Inversion**:
   When `direction === 'backward'`, KeysetEngine flips the SQL `ORDER BY` clause and comparison operators. This forces the database engine to seek the items immediately preceding the boundary cursor:
   ```sql
   WHERE id < 41
   ORDER BY id DESC -- Reversed in SQL!
   LIMIT 21;
   ```
   The database returns items `[40, 39, 38, ... 21]`.

2. **In-Memory Order Restoration**:
   Before returning the page envelope to the application, KeysetEngine reverses the in-memory array (`items.reverse()`), ensuring the items are delivered in their **natural, forward-ascending sequence** (`[21, 22, ... 40]`).

---

## Cursor Protocol Rules

When navigating an API using KeysetEngine, clients must adhere to this standard protocol:

1. **First Page (Page 1)**:
   ```ts
   const page1 = await getOrders({ limit: 20 });
   ```
2. **Next Page (Forward)**:
   Pass `cursor = page1.endCursor` with `direction = 'forward'`:
   ```ts
   const page2 = await getOrders({
     cursor: page1.endCursor,
     direction: 'forward',
     limit: 20
   });
   ```
3. **Previous Page (Backward)**:
   Pass `cursor = page2.startCursor` with `direction = 'backward'`:
   ```ts
   const page1Back = await getOrders({
     cursor: page2.startCursor,
     direction: 'backward',
     limit: 20
   });
   ```

---

## Pagination State Indicators

| Direction | Condition | `hasPreviousPage` | `hasNextPage` |
| :--- | :--- | :--- | :--- |
| **Forward** | Initial Page (`cursor == null`) | `false` | `rows.length > limit` |
| **Forward** | Intermediate Page (`cursor != null`) | `true` | `rows.length > limit` |
| **Backward** | Moving backward | `rows.length > limit` | `true` |
| **Backward** | Reached top of table | `false` | `true` |
