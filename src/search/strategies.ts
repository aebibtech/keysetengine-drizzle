import { type AnyColumn, type SQL, ilike, sql } from 'drizzle-orm';
import type { SearchStrategy } from '../types.js';

/**
 * Universal text search strategy using lower(col) LIKE '%term%'.
 * Works uniformly across SQLite, PostgreSQL, and MySQL.
 */
export const likeSearchStrategy: SearchStrategy = (
  column: AnyColumn,
  searchTerm: string
): SQL => {
  const pattern = `%${searchTerm.toLowerCase()}%`;
  return sql`lower(${column}) LIKE ${pattern}`;
};

/**
 * PostgreSQL-specific ILIKE strategy.
 */
export const ilikeSearchStrategy: SearchStrategy = (
  column: AnyColumn,
  searchTerm: string
): SQL => {
  return ilike(column, `%${searchTerm}%`);
};

/**
 * PostgreSQL-specific full-text tsvector search strategy.
 */
export const postgresTsVectorSearchStrategy = (
  configLanguage: string = 'english'
): SearchStrategy => {
  return (column: AnyColumn, searchTerm: string): SQL => {
    return sql`to_tsvector(${sql.raw(`'${configLanguage}'`)}, ${column}) @@ plainto_tsquery(${sql.raw(`'${configLanguage}'`)}, ${searchTerm})`;
  };
};

/**
 * Resolves a search strategy identifier or custom function into a valid SearchStrategy.
 */
export function resolveSearchStrategy(
  strategy?: SearchStrategy | 'like' | 'ilike' | 'tsvector'
): SearchStrategy {
  if (typeof strategy === 'function') {
    return strategy;
  }
  switch (strategy) {
    case 'ilike':
      return ilikeSearchStrategy;
    case 'tsvector':
      return postgresTsVectorSearchStrategy();
    case 'like':
    default:
      return likeSearchStrategy;
  }
}
