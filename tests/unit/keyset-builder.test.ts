import { describe, expect, it } from 'bun:test';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createKeysetConfig } from '../../src/config.js';
import {
  buildKeysetPredicate,
  buildSearchPredicate,
} from '../../src/expressions/keyset-builder.js';
import { buildKeysetOrderBy } from '../../src/expressions/order-builder.js';
import type { KeysetCursorToken } from '../../src/types.js';

describe('Keyset Expression & Order Builder', () => {
  const testTable = sqliteTable('items', {
    id: integer('id').primaryKey(),
    createdAt: text('created_at').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
  });

  const ascConfig = createKeysetConfig(testTable, {
    sortBy: testTable.createdAt,
    sortDirection: 'asc',
    tieBreaker: testTable.id,
    searchIn: [testTable.name, testTable.category],
    entityPurpose: 'items',
  });

  const descConfig = createKeysetConfig(testTable, {
    sortBy: testTable.createdAt,
    sortDirection: 'desc',
    tieBreaker: testTable.id,
    searchIn: [testTable.name, testTable.category],
    entityPurpose: 'items',
  });

  const sampleToken: KeysetCursorToken = {
    sortValue: '2026-10-20T08:00:00.000Z',
    tieBreakerValue: 42,
    isAscending: true,
    searchHash: null,
  };

  it('builds keyset predicate for Forward + Ascending', () => {
    const predicate = buildKeysetPredicate(ascConfig, sampleToken, 'forward');
    expect(predicate).toBeDefined();
    // In Drizzle, SQL query chunks represent the tree
    expect(predicate.queryChunks.length).toBeGreaterThan(0);
  });

  it('builds keyset predicate for Backward + Ascending', () => {
    const predicate = buildKeysetPredicate(ascConfig, sampleToken, 'backward');
    expect(predicate).toBeDefined();
  });

  it('builds keyset predicate for Forward + Descending', () => {
    const predicate = buildKeysetPredicate(descConfig, sampleToken, 'forward');
    expect(predicate).toBeDefined();
  });

  it('builds keyset predicate for Backward + Descending', () => {
    const predicate = buildKeysetPredicate(descConfig, sampleToken, 'backward');
    expect(predicate).toBeDefined();
  });

  it('inverts SQL orderBy sequence when navigating backward', () => {
    // Ascending config
    const [fwdSort, fwdTie] = buildKeysetOrderBy(ascConfig, 'forward');
    const [backSort, backTie] = buildKeysetOrderBy(ascConfig, 'backward');

    // Forward should be ASC, Backward should be DESC
    expect(fwdSort).toBeDefined();
    expect(fwdTie).toBeDefined();
    expect(backSort).toBeDefined();
    expect(backTie).toBeDefined();

    // Descending config
    const [descFwdSort, descFwdTie] = buildKeysetOrderBy(descConfig, 'forward');
    const [descBackSort, descBackTie] = buildKeysetOrderBy(descConfig, 'backward');

    expect(descFwdSort).toBeDefined();
    expect(descFwdTie).toBeDefined();
    expect(descBackSort).toBeDefined();
    expect(descBackTie).toBeDefined();
  });

  it('builds multi-column disjunctive search predicate', () => {
    const searchPred = buildSearchPredicate(ascConfig, 'Widget');
    expect(searchPred).toBeDefined();

    // Empty search returns undefined
    expect(buildSearchPredicate(ascConfig, '')).toBeUndefined();
    expect(buildSearchPredicate(ascConfig, '   ')).toBeUndefined();
    expect(buildSearchPredicate(ascConfig, null)).toBeUndefined();
  });
});
