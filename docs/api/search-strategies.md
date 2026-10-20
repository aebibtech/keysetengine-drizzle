# Search Strategies API Reference

This module provides text search adapters for translating multi-column search terms into database-compatible SQL expressions.

---

## Strategy Type Signature

```ts
type SearchStrategy = (column: AnyColumn, searchTerm: string) => SQL;
```

---

## Built-In Strategies

### `likeSearchStrategy`
Universal case-insensitive text search strategy. Emits `lower(column) LIKE lower('%term%')`. Compatible across SQLite, PostgreSQL, and MySQL.

```ts
const likeSearchStrategy: SearchStrategy;
```

---

### `ilikeSearchStrategy`
PostgreSQL-specific case-insensitive text search strategy. Emits `column ILIKE '%term%'`.

```ts
const ilikeSearchStrategy: SearchStrategy;
```

---

### `postgresTsVectorSearchStrategy(configLanguage?)`
PostgreSQL full-text search strategy for tsvector/tsquery evaluations. Emits:
```sql
to_tsvector(configLanguage, column) @@ plainto_tsquery(configLanguage, searchTerm)
```

```ts
function postgresTsVectorSearchStrategy(configLanguage?: string): SearchStrategy;
```

**Parameters**:
- `configLanguage`: Text search dictionary language (defaults to `'english'`).

---

## `resolveSearchStrategy(strategy?)`

Resolves a strategy shorthand name (`'like'`, `'ilike'`, `'tsvector'`) or a custom callback function into a callable `SearchStrategy`.

```ts
function resolveSearchStrategy(
  strategy?: SearchStrategy | 'like' | 'ilike' | 'tsvector'
): SearchStrategy;
```

---

## Authoring Custom Strategies

You can pass any custom function returning a Drizzle `SQL` expression:

```ts
import { sql } from 'drizzle-orm';
import { createKeysetConfig } from 'keysetengine-drizzle';

export const customKeyset = createKeysetConfig(orders, {
  sortBy: orders.createdAt,
  tieBreaker: orders.id,
  searchIn: [orders.customerName],
  // Custom prefix search
  searchStrategy: (column, term) => sql`${column} LIKE ${term + '%'}`,
});
```
