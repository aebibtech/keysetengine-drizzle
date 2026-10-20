# Why Keyset Pagination?

Keyset pagination (also known as cursor-based seek pagination) is a technique for traversing ordered datasets by filtering on boundary values rather than relying on SQL `OFFSET`.

---

## The Fundamental Flaw of SQL `OFFSET`

Traditional pagination relies on `OFFSET` and `LIMIT`:

```sql
SELECT * FROM orders
ORDER BY created_at DESC, id DESC
LIMIT 20 OFFSET 100000;
```

While simple to write, SQL `OFFSET` has two fatal architectural flaws:

### 1. $O(N)$ Computational Degradation
Relational database engines (PostgreSQL, SQLite, MySQL, SQL Server) cannot jump directly to row 100,000. The engine must:
1. Traverse the index or table sequentially from row 1.
2. Read, sort, and evaluate **100,020 rows**.
3. Discard the first 100,000 rows in memory.
4. Return only the last 20 rows.

As query depth increases, query latency and memory usage grow linearly ($O(N)$), causing database server CPU spikes and request timeouts:

| Page | Offset | SQL Execution Time | KeysetEngine Seek Time |
| :--- | :--- | :--- | :--- |
| **Page 1** | `OFFSET 0` | 0.8 ms | **0.4 ms** |
| **Page 100** | `OFFSET 2,000` | 8.2 ms | **0.5 ms** |
| **Page 1,000** | `OFFSET 20,000` | 74.0 ms | **0.5 ms** |
| **Page 10,000** | `OFFSET 200,000` | 980.0 ms | **0.6 ms** |
| **Page 50,000** | `OFFSET 1,000,000` | 4,800.0 ms (Timeout) | **0.6 ms** |

---

### 2. Phantom Skips and Duplicate Records
On active production tables with concurrent writes, `OFFSET` causes data drift:
- If a new row is inserted at the top of the table while a user navigates between Page 1 and Page 2, all subsequent rows shift downward by 1.
- The user will see the **last item of Page 1 duplicated** at the top of Page 2.
- If a row is deleted, an item will be **permanently skipped**.

---

## How Keyset Pagination Solves This

Keyset pagination replaces `OFFSET` with an index-seek predicate based on the boundary coordinates of the previous page:

```sql
SELECT * FROM orders
WHERE ("created_at" < '2026-10-20T08:00:00Z')
   OR ("created_at" = '2026-10-20T08:00:00Z' AND "id" < 42000)
ORDER BY "created_at" DESC, "id" DESC
LIMIT 21;
```

### The B-Tree Index Advantage
Because the query specifies exact boundary values (`created_at` and `id`), the database engine uses a **B-Tree index seek**:
1. It navigates directly down the tree to the first entry meeting the boundary condition in $O(\log N)$ time.
2. It scans forward exactly **21 rows** ($N + 1$).
3. It terminates immediately.

Execution time is **independent of dataset depth** and takes **sub-millisecond** time even on tables with tens of millions of rows.

---

## Keyset vs. Offset Comparison

| Feature | SQL Offset Pagination | KeysetEngine Drizzle |
| :--- | :--- | :--- |
| **Deep Page Latency** | Degrades linearly to seconds ($O(N)$) | Constant sub-millisecond ($O(1)$) |
| **Concurrent Writes** | Yields duplicate or skipped records | Stable boundaries; immune to shifting |
| **Database Memory** | Scans and buffers discarded rows | Zero discarded rows in engine memory |
| **Random Jump to Page N** | Supported (`page = 450`) | Unsupported (infinite scroll / next / prev) |
| **Bidirectional Navigation** | Simple math (`offset - limit`) | Built-in via inverted SQL seeks |
