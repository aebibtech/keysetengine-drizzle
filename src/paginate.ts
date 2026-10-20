import { and, type SQL, type Table } from 'drizzle-orm';
import {
  buildKeysetClause,
  formatKeysetPage,
  type KeysetExecutionOptions,
} from './query-builder.js';
import type { KeysetConfig, KeysetPage, KeysetRequest } from './types.js';

/**
 * Compatible structural interface matching Drizzle dynamic select query builders across all dialects
 * (PostgreSQL, SQLite, MySQL).
 */
export interface DrizzleSelectQuery<TRow = Record<string, unknown>> {
  where(condition?: SQL): this;
  orderBy(...clauses: (SQL | import('drizzle-orm').AnyColumn)[]): this;
  limit(limit: number): this;
  then<TResult1 = TRow[], TResult2 = never>(
    onfulfilled?: ((value: TRow[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
  config?: {
    where?: SQL;
    [key: string]: unknown;
  };
}

/**
 * Executes high-performance keyset pagination on a Drizzle select query.
 *
 * Applies:
 * 1. Multi-column search predicates.
 * 2. Keyset boundary disjunctions (O(1) index seeks).
 * 3. Dynamic ordering with automatic reversal on backward traversal.
 * 4. N + 1 slice evaluation.
 * 5. In-memory order restoration and opaque edge cursor minting.
 *
 * @param query The Drizzle dynamic select query (e.g. `db.select().from(table).$dynamic()`).
 * @param config Keyset configuration created via `createKeysetConfig`.
 * @param request Incoming pagination request (cursor, direction, limit, search).
 * @param options Optional execution options (e.g. custom CryptoCursorProtector).
 */
export async function paginateKeyset<
  TTable extends Table,
  TRow extends Record<string, unknown> = Record<string, unknown>,
  TQuery extends DrizzleSelectQuery<TRow> = DrizzleSelectQuery<TRow>,
>(
  query: TQuery,
  config: KeysetConfig<TTable>,
  request: KeysetRequest = {},
  options?: KeysetExecutionOptions
): Promise<KeysetPage<TRow>> {
  if (!query) {
    throw new Error('Drizzle query must be provided to paginateKeyset.');
  }
  if (!config) {
    throw new Error('KeysetConfig must be provided to paginateKeyset.');
  }

  // 1. Build keyset query components
  const components = buildKeysetClause(config, request, options);

  // 2. Safely apply WHERE clause, preserving any pre-existing query filters
  const existingWhere = query.config?.where;
  if (existingWhere && components.where) {
    query.where(and(existingWhere, components.where));
  } else if (components.where) {
    query.where(components.where);
  }

  // 3. Apply ORDER BY (flipped automatically if navigating backward)
  query.orderBy(...components.orderBy);

  // 4. Apply LIMIT (fetches limit + 1 items)
  query.limit(components.limit);

  // 5. Execute query
  const rawRows = (await query) as TRow[];

  // 6. Slice, reverse if backward, and generate edge cursors
  return formatKeysetPage(
    rawRows,
    request,
    config,
    components.cursorToken,
    options
  );
}
