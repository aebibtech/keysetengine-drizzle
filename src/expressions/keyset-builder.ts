import {
  type AnyColumn,
  type SQL,
  and,
  eq,
  gt,
  lt,
  or,
} from 'drizzle-orm';
import type { KeysetConfig, KeysetCursorToken, PageDirection } from '../types.js';

/**
 * Coerces deserialized token boundary values into proper runtime types matching Drizzle columns.
 */
export function coerceColumnValue(column: AnyColumn, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (column.dataType === 'date') {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
  }
  if (column.dataType === 'bigint') {
    if (typeof value === 'string' || typeof value === 'number') {
      try {
        return BigInt(value);
      } catch {
        return value;
      }
    }
  }
  return value;
}

/**
 * Serializes entity edge values into JSON-compatible token primitives.
 */
export function serializeColumnValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

/**
 * Builds the nested boolean keyset boundary predicate:
 *
 * Forward + Ascending:
 *   (SortCol > sortVal) OR (SortCol = sortVal AND TieBreaker > tieVal)
 *
 * Forward + Descending:
 *   (SortCol < sortVal) OR (SortCol = sortVal AND TieBreaker < tieVal)
 *
 * Backward + Ascending:
 *   (SortCol < sortVal) OR (SortCol = sortVal AND TieBreaker < tieVal)
 *
 * Backward + Descending:
 *   (SortCol > sortVal) OR (SortCol = sortVal AND TieBreaker > tieVal)
 *
 * Universal across PostgreSQL, SQLite, and MySQL without requiring SQL row-value tuples.
 */
export function buildKeysetPredicate<TTable extends import('drizzle-orm').Table>(
  config: KeysetConfig<TTable>,
  token: KeysetCursorToken,
  direction: PageDirection = 'forward'
): SQL {
  const sortCol = config.sortColumn;
  const tieCol = config.tieBreakerColumn;

  const rawSortVal = coerceColumnValue(sortCol, token.sortValue);
  const rawTieVal = coerceColumnValue(tieCol, token.tieBreakerValue);

  // Determine effective inequality direction:
  // Forward + Ascending  -> GreaterThan (>)
  // Forward + Descending -> LessThan (<)
  // Backward + Ascending  -> LessThan (<)
  // Backward + Descending -> GreaterThan (>)
  const isAscending = config.isAscending;
  const effectiveGreater =
    (isAscending && direction === 'forward') ||
    (!isAscending && direction === 'backward');

  const firstComparison = effectiveGreater
    ? gt(sortCol, rawSortVal)
    : lt(sortCol, rawSortVal);

  const firstEquality = eq(sortCol, rawSortVal);

  const secondComparison = effectiveGreater
    ? gt(tieCol, rawTieVal)
    : lt(tieCol, rawTieVal);

  const andClause = and(firstEquality, secondComparison);

  // Return disjunction: (SortCol [>] sortVal) OR (SortCol = sortVal AND Tie [>] tieVal)
  return or(firstComparison, andClause)!;
}

/**
 * Combines configured search columns into a disjunctive search predicate:
 *   or(strategy(col1, term), strategy(col2, term), ...)
 */
export function buildSearchPredicate<TTable extends import('drizzle-orm').Table>(
  config: KeysetConfig<TTable>,
  searchTerm?: string | null
): SQL | undefined {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return undefined;
  }
  if (!config.searchColumns || config.searchColumns.length === 0) {
    return undefined;
  }

  const trimmed = searchTerm.trim();
  const predicates = config.searchColumns.map((col) =>
    config.searchStrategy(col, trimmed)
  );

  if (predicates.length === 1) {
    return predicates[0];
  }

  return or(...predicates);
}
