# Core API Reference

The core module provides the primary contracts, configuration builders, and execution functions for KeysetEngine Drizzle.

---

## `createKeysetConfig(table, options)`

Creates an immutable, strongly-typed configuration defining keyset boundaries, ordering, search columns, and cursor token isolation.

```ts
function createKeysetConfig<TTable extends Table>(
  table: TTable,
  options: KeysetConfigOptions<TTable>
): KeysetConfig<TTable>
```

### Parameters

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `sortBy` | `AnyColumn \| ((table: TTable) => AnyColumn)` | *Required* | Primary column to sort by. Must be non-nullable. |
| `sortDirection` | `'asc' \| 'desc'` | `'asc'` | Default sort direction. |
| `tieBreaker` | `AnyColumn \| ((table: TTable) => AnyColumn)` | *Required* | Unique, non-nullable column (usually primary key). |
| `searchIn` | `(AnyColumn \| ((table: TTable) => AnyColumn))[]` | `[]` | Optional list of string columns to include in text search. |
| `searchStrategy`| `SearchStrategy \| 'like' \| 'ilike' \| 'tsvector'` | `'like'` | Search strategy to emit SQL search predicates. |
| `entityPurpose` | `string` | Table Name | Purpose scope for cryptographic cursor isolation. |

---

## `paginateKeyset(query, config, request, options?)`

Executes high-performance keyset pagination on a Drizzle dynamic select query.

```ts
async function paginateKeyset<
  TTable extends Table,
  TRow extends Record<string, unknown> = Record<string, unknown>
>(
  query: DrizzleSelectQuery<TRow>,
  config: KeysetConfig<TTable>,
  request?: KeysetRequest,
  options?: KeysetExecutionOptions
): Promise<KeysetPage<TRow>>
```

### Parameters
- **`query`**: Drizzle select query with `$dynamic()` enabled (e.g. `db.select().from(orders).$dynamic()`).
- **`config`**: Configuration object produced by `createKeysetConfig`.
- **`request`**: Incoming pagination parameters (`cursor`, `direction`, `limit`, `search`).
- **`options`**: Optional execution settings, such as `{ protector: new CryptoCursorProtector(...) }`.

---

## `buildKeysetClause(config, request?, options?)`

Generates granular SQL components (`where`, `orderBy`, `limit`) for manual query composition or Drizzle Relational Queries (`db.query.table.findMany`).

```ts
function buildKeysetClause<TTable extends Table>(
  config: KeysetConfig<TTable>,
  request?: KeysetRequest,
  options?: KeysetExecutionOptions
): KeysetQueryComponents
```

### Returns
- **`where`**: `SQL | undefined` — Combined search and keyset boundary predicate.
- **`orderBy`**: `[SQL, SQL]` — Order clauses with automatic inversion on backward traversal.
- **`limit`**: `number` — Requested limit + 1.
- **`cursorToken`**: `KeysetCursorToken | null` — Deserialized cursor token.

---

## `formatKeysetPage(rawRows, request, config, cursorToken, options?)`

Evaluates an $N + 1$ result slice, applies in-memory array reversal if navigating backward, and mints opaque edge cursors.

```ts
function formatKeysetPage<TTable extends Table, TRow extends Record<string, unknown>>(
  rawRows: TRow[],
  request: KeysetRequest,
  config: KeysetConfig<TTable>,
  cursorToken: KeysetCursorToken | null,
  options?: KeysetExecutionOptions
): KeysetPage<TRow>
```

---

## Domain Types

### `KeysetRequest`
```ts
interface KeysetRequest {
  cursor?: string | null;
  direction?: 'forward' | 'backward';
  limit?: number;
  search?: string | null;
}
```

### `KeysetPage<T>`
```ts
interface KeysetPage<T> {
  items: T[];
  startCursor: string | null;
  endCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
```

### `KeysetCursorToken`
```ts
interface KeysetCursorToken {
  sortValue: unknown;
  tieBreakerValue: unknown;
  isAscending: boolean;
  searchHash: string | null;
}
```
