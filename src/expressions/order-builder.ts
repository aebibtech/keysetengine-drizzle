import { type SQL, asc, desc } from 'drizzle-orm';
import type { KeysetConfig, PageDirection } from '../types.js';

/**
 * Generates SQL orderBy expressions with automatic order inversion on backward navigation.
 *
 * Forward + Ascending  -> [ASC(Sort),  ASC(Tie)]
 * Forward + Descending -> [DESC(Sort), DESC(Tie)]
 * Backward + Ascending -> [DESC(Sort), DESC(Tie)] (flipped)
 * Backward + Descending-> [ASC(Sort),  ASC(Tie)]  (flipped)
 */
export function buildKeysetOrderBy<TTable extends import('drizzle-orm').Table>(
  config: KeysetConfig<TTable>,
  direction: PageDirection = 'forward'
): [SQL, SQL] {
  const isAscending = config.isAscending;

  // Invert order if navigating backward
  const effectiveAscending =
    direction === 'forward' ? isAscending : !isAscending;

  const sortOrder = effectiveAscending
    ? asc(config.sortColumn)
    : desc(config.sortColumn);
  const tieOrder = effectiveAscending
    ? asc(config.tieBreakerColumn)
    : desc(config.tieBreakerColumn);

  return [sortOrder, tieOrder];
}
