import { beforeAll, describe, expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createKeysetConfig } from '../../src/config.js';
import { CryptoCursorProtector } from '../../src/crypto/crypto-protector.js';
import { paginateKeyset } from '../../src/paginate.js';
import type { KeysetRequest } from '../../src/types.js';

describe('SQLite Real Database Integration Tests (KeysetEngine + Drizzle)', () => {
  const orders = sqliteTable('orders', {
    id: integer('id').primaryKey(),
    customerName: text('customer_name').notNull(),
    description: text('description').notNull(),
    createdAt: text('created_at').notNull(),
    amount: integer('amount').notNull(),
  });

  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);

  const config = createKeysetConfig(orders, {
    sortBy: orders.createdAt,
    sortDirection: 'asc',
    tieBreaker: orders.id,
    searchIn: [orders.customerName, orders.description],
    entityPurpose: 'orders',
  });

  const TOTAL_RECORDS = 2000;

  beforeAll(() => {
    // 1. Create table and index
    sqlite.exec(`
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        customer_name TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL,
        amount INTEGER NOT NULL
      );
      CREATE INDEX idx_orders_created_at_id ON orders(created_at, id);
    `);

    // 2. Seed 2,000 records in a single transaction
    const baseDate = new Date('2026-01-01T00:00:00.000Z').getTime();
    const insertStmt = sqlite.prepare(`
      INSERT INTO orders (id, customer_name, description, created_at, amount)
      VALUES (?, ?, ?, ?, ?)
    `);

    sqlite.transaction(() => {
      for (let i = 1; i <= TOTAL_RECORDS; i++) {
        // Group every 3 records with identical timestamp to test tie-breaker sorting
        const timestamp = new Date(baseDate + Math.floor((i - 1) / 3) * 3600000).toISOString();
        const customer = `Customer_${String(i).padStart(4, '0')}`;
        const desc = i % 2 === 0
          ? `Quantum Dynamics Part ${i}`
          : `Standard Fulfillment ${i}`;
        const amount = i * 10;
        insertStmt.run(i, customer, desc, timestamp, amount);
      }
    })();
  });

  it('executes seamless forward pagination through the whole 2000-record dataset with no gaps or duplicates', async () => {
    const pageSize = 100;
    const retrievedIds: number[] = [];
    let cursor: string | null = null;
    let pageCount = 0;

    while (true) {
      const request: KeysetRequest = {
        cursor,
        limit: pageSize,
        direction: 'forward',
      };

      const query = db.select().from(orders).$dynamic();
      const page = await paginateKeyset(query, config, request);

      pageCount++;
      retrievedIds.push(...page.items.map((x) => x.id));

      if (pageCount === 1) {
        expect(page.hasPreviousPage).toBe(false);
      } else {
        expect(page.hasPreviousPage).toBe(true);
      }

      if (!page.hasNextPage) {
        break;
      }

      expect(page.endCursor).not.toBeNull();
      cursor = page.endCursor;
    }

    // Verify all 2000 records were visited exactly once in strictly ascending order
    expect(retrievedIds).toHaveLength(TOTAL_RECORDS);
    expect(new Set(retrievedIds).size).toBe(TOTAL_RECORDS);

    for (let i = 0; i < retrievedIds.length; i++) {
      expect(retrievedIds[i]).toBe(i + 1);
    }
  });

  it('maintains natural forward order during continuous bidirectional navigation', async () => {
    const pageSize = 25;

    // Page 1 (IDs 1..25)
    const q1 = db.select().from(orders).$dynamic();
    const p1 = await paginateKeyset(q1, config, { limit: pageSize });
    expect(p1.items).toHaveLength(pageSize);
    expect(p1.hasPreviousPage).toBe(false);
    expect(p1.hasNextPage).toBe(true);
    expect(p1.items.map((x) => x.id)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 1)
    );

    // Page 2 (IDs 26..50)
    const q2 = db.select().from(orders).$dynamic();
    const p2 = await paginateKeyset(q2, config, { cursor: p1.endCursor, limit: pageSize });
    expect(p2.items).toHaveLength(pageSize);
    expect(p2.hasPreviousPage).toBe(true);
    expect(p2.hasNextPage).toBe(true);
    expect(p2.items.map((x) => x.id)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 26)
    );

    // Page 3 (IDs 51..75)
    const q3 = db.select().from(orders).$dynamic();
    const p3 = await paginateKeyset(q3, config, { cursor: p2.endCursor, limit: pageSize });
    expect(p3.items).toHaveLength(pageSize);
    expect(p3.hasPreviousPage).toBe(true);
    expect(p3.hasNextPage).toBe(true);
    expect(p3.items.map((x) => x.id)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 51)
    );

    // Navigate Backward: Page 3 StartCursor -> Should return Page 2 (IDs 26..50) in natural forward order!
    const qBack2 = db.select().from(orders).$dynamic();
    const pBack2 = await paginateKeyset(qBack2, config, {
      cursor: p3.startCursor,
      direction: 'backward',
      limit: pageSize,
    });

    expect(pBack2.items).toHaveLength(pageSize);
    expect(pBack2.hasPreviousPage).toBe(true);
    expect(pBack2.hasNextPage).toBe(true);
    expect(pBack2.items.map((x) => x.id)).toEqual(p2.items.map((x) => x.id));

    // Navigate Backward: Page 2 StartCursor -> Should return Page 1 (IDs 1..25) in natural forward order!
    const qBack1 = db.select().from(orders).$dynamic();
    const pBack1 = await paginateKeyset(qBack1, config, {
      cursor: pBack2.startCursor,
      direction: 'backward',
      limit: pageSize,
    });

    expect(pBack1.items).toHaveLength(pageSize);
    expect(pBack1.hasPreviousPage).toBe(false);
    expect(pBack1.hasNextPage).toBe(true);
    expect(pBack1.items.map((x) => x.id)).toEqual(p1.items.map((x) => x.id));
  });

  it('filters results correctly with multi-column text search combined with keyset boundaries', async () => {
    // Search "Quantum Dynamics" (even IDs: 2, 4, 6...)
    const query = db.select().from(orders).$dynamic();
    const page1 = await paginateKeyset(query, config, {
      limit: 10,
      search: 'Quantum Dynamics',
    });

    expect(page1.items).toHaveLength(10);
    expect(page1.items.map((x) => x.id)).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    expect(page1.hasNextPage).toBe(true);

    // Page 2 of search
    const query2 = db.select().from(orders).$dynamic();
    const page2 = await paginateKeyset(query2, config, {
      cursor: page1.endCursor,
      limit: 10,
      search: 'Quantum Dynamics',
    });

    expect(page2.items).toHaveLength(10);
    expect(page2.items.map((x) => x.id)).toEqual([22, 24, 26, 28, 30, 32, 34, 36, 38, 40]);
  });

  it('invalidates stale cursor when search term changes and restarts query at Page 1', async () => {
    // 1. Page 1 under "Quantum"
    const q1 = db.select().from(orders).$dynamic();
    const p1 = await paginateKeyset(q1, config, {
      limit: 5,
      search: 'Quantum',
    });
    expect(p1.items.map((x) => x.id)).toEqual([2, 4, 6, 8, 10]);

    // 2. Submit p1.endCursor but with a DIFFERENT search term "Standard" (odd numbers: 1, 3, 5...)
    const q2 = db.select().from(orders).$dynamic();
    const p2WithNewSearch = await paginateKeyset(q2, config, {
      cursor: p1.endCursor,
      limit: 5,
      search: 'Standard',
    });

    // Stale cursor must be ignored; should yield page 1 of "Standard"
    expect(p2WithNewSearch.items.map((x) => x.id)).toEqual([1, 3, 5, 7, 9]);
    expect(p2WithNewSearch.hasPreviousPage).toBe(false);
  });

  it('cryptographically protects cursors with CryptoCursorProtector and gracefully handles tampered tokens', async () => {
    const cryptoProtector = new CryptoCursorProtector('a-very-strong-production-master-secret-key-32b');

    // Page 1 with cryptographic protector
    const q1 = db.select().from(orders).$dynamic();
    const p1 = await paginateKeyset(
      q1,
      config,
      { limit: 5 },
      { protector: cryptoProtector }
    );

    expect(p1.endCursor).not.toBeNull();

    // Tamper with cursor
    const tampered = p1.endCursor!.slice(0, -4) + 'zzzz';

    // Submit tampered cursor
    const qTampered = db.select().from(orders).$dynamic();
    const pTampered = await paginateKeyset(
      qTampered,
      config,
      { cursor: tampered, limit: 5 },
      { protector: cryptoProtector }
    );

    // Tampered cursor is caught and gracefully resets to Page 1
    expect(pTampered.items.map((x) => x.id)).toEqual([1, 2, 3, 4, 5]);
    expect(pTampered.hasPreviousPage).toBe(false);
  });
});
