import { and, type SQL, type Table } from 'drizzle-orm';
import { Base64UrlCursorProtector } from './crypto/base64url-protector.js';
import { computeSearchHash, matchesSearchHash } from './crypto/search-hash.js';
import {
  buildKeysetPredicate,
  buildSearchPredicate,
  serializeColumnValue,
} from './expressions/keyset-builder.js';
import { buildKeysetOrderBy } from './expressions/order-builder.js';
import type {
  CursorProtector,
  KeysetConfig,
  KeysetCursorToken,
  KeysetPage,
  KeysetRequest,
  PageDirection,
} from './types.js';

export interface KeysetQueryComponents {
  where: SQL | undefined;
  orderBy: [SQL, SQL];
  limit: number;
  direction: PageDirection;
  cursorToken: KeysetCursorToken | null;
  searchHash: string | null;
}

export interface KeysetExecutionOptions {
  protector?: CursorProtector;
}

const defaultProtector = new Base64UrlCursorProtector();

/**
 * Builds the where, orderBy, and limit components required for keyset pagination.
 * Handles stale cursor detection and cursor invalidation automatically.
 */
export function buildKeysetClause<TTable extends Table>(
  config: KeysetConfig<TTable>,
  request: KeysetRequest = {},
  options?: KeysetExecutionOptions
): KeysetQueryComponents {
  const protector = options?.protector ?? defaultProtector;
  const direction: PageDirection = request.direction ?? 'forward';
  const limit = Math.max(1, request.limit ?? 20);

  // 1. Dynamic Search Predicate
  const searchPredicate = buildSearchPredicate(config, request.search);
  const currentSearchHash = computeSearchHash(request.search);

  // 2. Cursor Token Processing & Stale Cursor Validation
  let cursorToken: KeysetCursorToken | null = null;
  if (request.cursor && request.cursor.trim().length > 0) {
    cursorToken = protector.unprotect(request.cursor, config.entityPurpose);

    // Stale cursor check: if the search filter changed since the cursor was minted,
    // invalidate cursor and gracefully fall back to Page 1
    if (
      cursorToken !== null &&
      !matchesSearchHash(request.search, cursorToken.searchHash)
    ) {
      cursorToken = null;
    }
  }

  // 3. Boundary Predicate
  let boundaryPredicate: SQL | undefined;
  if (cursorToken !== null) {
    boundaryPredicate = buildKeysetPredicate(config, cursorToken, direction);
  }

  // 4. Combine Filters
  let combinedWhere: SQL | undefined;
  if (searchPredicate && boundaryPredicate) {
    combinedWhere = and(searchPredicate, boundaryPredicate);
  } else {
    combinedWhere = searchPredicate ?? boundaryPredicate;
  }

  // 5. Dynamic OrderBy with Bidirectional Inversion
  const orderBy = buildKeysetOrderBy(config, direction);

  return {
    where: combinedWhere,
    orderBy,
    limit: limit + 1, // Request N + 1 items to determine hasNext/hasPrevious
    direction,
    cursorToken,
    searchHash: currentSearchHash,
  };
}

/**
 * Extracts a property value from a row object, checking propertyKey first, then column name.
 */
function extractValue(row: Record<string, unknown>, propertyKey: string, columnName: string): unknown {
  if (propertyKey in row) {
    return row[propertyKey];
  }
  if (columnName in row) {
    return row[columnName];
  }
  return undefined;
}

/**
 * Evaluates the N+1 result slice, performs in-memory reversal if traversing backward,
 * and mints opaque edge cursors.
 */
export function formatKeysetPage<TTable extends Table, TRow extends Record<string, unknown>>(
  rawRows: TRow[],
  request: KeysetRequest,
  config: KeysetConfig<TTable>,
  cursorToken: KeysetCursorToken | null,
  options?: KeysetExecutionOptions
): KeysetPage<TRow> {
  const protector = options?.protector ?? defaultProtector;
  const direction: PageDirection = request.direction ?? 'forward';
  const limit = Math.max(1, request.limit ?? 20);

  const items = [...rawRows];
  const hasMoreInDirection = items.length > limit;

  // Pop the (N+1)th slice item
  if (hasMoreInDirection) {
    items.pop();
  }

  let hasNextPage: boolean;
  let hasPreviousPage: boolean;

  if (direction === 'forward') {
    hasPreviousPage = cursorToken !== null;
    hasNextPage = hasMoreInDirection;
  } else {
    // Backward traversal: rows were fetched in inverted SQL order
    hasPreviousPage = hasMoreInDirection;
    hasNextPage = true;
    items.reverse(); // Restore natural forward order
  }

  // Mint edge cursors
  let startCursor: string | null = null;
  let endCursor: string | null = null;

  if (items.length > 0) {
    const currentSearchHash = computeSearchHash(request.search);
    const firstItem = items[0]!;
    const lastItem = items[items.length - 1]!;

    const firstSort = extractValue(firstItem, config.sortPropertyKey, config.sortColumn.name);
    const firstTie = extractValue(firstItem, config.tieBreakerPropertyKey, config.tieBreakerColumn.name);

    const startToken: KeysetCursorToken = {
      sortValue: serializeColumnValue(firstSort),
      tieBreakerValue: serializeColumnValue(firstTie),
      isAscending: config.isAscending,
      searchHash: currentSearchHash,
    };
    startCursor = protector.protect(startToken, config.entityPurpose);

    const lastSort = extractValue(lastItem, config.sortPropertyKey, config.sortColumn.name);
    const lastTie = extractValue(lastItem, config.tieBreakerPropertyKey, config.tieBreakerColumn.name);

    const endToken: KeysetCursorToken = {
      sortValue: serializeColumnValue(lastSort),
      tieBreakerValue: serializeColumnValue(lastTie),
      isAscending: config.isAscending,
      searchHash: currentSearchHash,
    };
    endCursor = protector.protect(endToken, config.entityPurpose);
  }

  return {
    items,
    startCursor,
    endCursor,
    hasNextPage,
    hasPreviousPage,
  };
}
