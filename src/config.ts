import { type AnyColumn, type Table, getTableName } from 'drizzle-orm';
import { resolveSearchStrategy } from './search/strategies.js';
import type { KeysetConfig, KeysetConfigOptions } from './types.js';

function resolveColumn<TTable extends Table>(
  table: TTable,
  colOrFn: AnyColumn | ((t: TTable) => AnyColumn)
): AnyColumn {
  if (typeof colOrFn === 'function') {
    return colOrFn(table);
  }
  return colOrFn;
}

function findPropertyKey(table: Table, column: AnyColumn): string {
  for (const [key, val] of Object.entries(table)) {
    if (val === column) {
      return key;
    }
  }
  return column.name;
}

/**
 * Creates an immutable, strongly-typed KeysetConfig for a Drizzle table.
 */
export function createKeysetConfig<TTable extends Table>(
  table: TTable,
  options: KeysetConfigOptions<TTable>
): KeysetConfig<TTable> {
  if (!table) {
    throw new Error('Table must be specified for createKeysetConfig.');
  }
  if (!options) {
    throw new Error('Options must be provided for createKeysetConfig.');
  }

  const sortColumn = resolveColumn(table, options.sortBy);
  if (!sortColumn) {
    throw new Error('sortBy column must be specified.');
  }

  const tieBreakerColumn = resolveColumn(table, options.tieBreaker);
  if (!tieBreakerColumn) {
    throw new Error('tieBreaker column must be specified.');
  }

  const isAscending = options.sortDirection !== 'desc';

  const searchColumns = (options.searchIn ?? []).map((col) =>
    resolveColumn(table, col)
  );

  const searchStrategy = resolveSearchStrategy(options.searchStrategy);

  let tableName = 'Entity';
  try {
    tableName = getTableName(table) || 'Entity';
  } catch {
    // Fallback if table name cannot be resolved
  }

  const entityPurpose = options.entityPurpose?.trim() || tableName;
  const sortPropertyKey = findPropertyKey(table, sortColumn);
  const tieBreakerPropertyKey = findPropertyKey(table, tieBreakerColumn);

  return {
    table,
    sortColumn,
    isAscending,
    tieBreakerColumn,
    searchColumns,
    searchStrategy,
    entityPurpose,
    sortPropertyKey,
    tieBreakerPropertyKey,
  };
}
