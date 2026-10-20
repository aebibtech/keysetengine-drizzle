import type { AnyColumn, SQL, Table } from 'drizzle-orm';

/**
 * Direction for keyset pagination navigation.
 * - 'forward': Moves toward subsequent records (Next).
 * - 'backward': Moves toward preceding records (Previous).
 */
export type PageDirection = 'forward' | 'backward';

/**
 * Incoming request parameters for keyset pagination and search.
 */
export interface KeysetRequest {
  /**
   * The opaque cursor token identifying the edge boundary of the adjacent page.
   */
  cursor?: string | null;

  /**
   * The navigation direction (defaults to 'forward').
   */
  direction?: PageDirection;

  /**
   * Maximum number of items requested per page (defaults to 20).
   */
  limit?: number;

  /**
   * Optional search term to filter results across configured columns.
   */
  search?: string | null;
}

/**
 * Paginated envelope containing data rows and opaque edge cursor tokens.
 */
export interface KeysetPage<T> {
  /**
   * The records belonging to the current page slice.
   */
  items: T[];

  /**
   * Opaque cursor token for the first item on this page (used to page backward).
   */
  startCursor: string | null;

  /**
   * Opaque cursor token for the last item on this page (used to page forward).
   */
  endCursor: string | null;

  /**
   * True if more records exist in the forward direction.
   */
  hasNextPage: boolean;

  /**
   * True if more records exist in the backward direction.
   */
  hasPreviousPage: boolean;
}

/**
 * Internal cursor token schema capturing edge boundary coordinates.
 */
export interface KeysetCursorToken {
  /**
   * JSON-serializable sort column value at page edge.
   */
  sortValue: unknown;

  /**
   * JSON-serializable unique tie-breaker column value (typically primary key) at page edge.
   */
  tieBreakerValue: unknown;

  /**
   * Whether the original query sort order was ascending.
   */
  isAscending: boolean;

  /**
   * Compact hash of the search term active when this cursor was minted.
   */
  searchHash: string | null;
}

/**
 * Contract for protecting and unprotecting opaque keyset cursor tokens.
 */
export interface CursorProtector {
  /**
   * Encodes/protects a cursor token into an opaque, URL-safe string scoped to an entity purpose.
   */
  protect(token: KeysetCursorToken, entityPurpose: string): string;

  /**
   * Decodes and validates an opaque cursor string scoped to the specified entity purpose.
   * Returns null if the cursor is missing, corrupt, tampered, expired, or bound to a different purpose.
   */
  unprotect(opaqueCursor: string | null | undefined, entityPurpose: string): KeysetCursorToken | null;
}

/**
 * Custom search strategy callback signature.
 */
export type SearchStrategy = (column: AnyColumn, searchTerm: string) => SQL;

/**
 * Configuration options for defining keyset boundaries on a Drizzle table.
 */
export interface KeysetConfigOptions<TTable extends Table> {
  /**
   * Primary sort column or accessor function (e.g. `table.createdAt` or `t => t.createdAt`).
   */
  sortBy: AnyColumn | ((table: TTable) => AnyColumn);

  /**
   * Sort direction: 'asc' | 'desc' (defaults to 'asc').
   */
  sortDirection?: 'asc' | 'desc';

  /**
   * Unique tie-breaker column or accessor function (e.g. `table.id` or `t => t.id`).
   * Must be unique and non-nullable.
   */
  tieBreaker: AnyColumn | ((table: TTable) => AnyColumn);

  /**
   * Optional array of string columns to include in universal text search.
   */
  searchIn?: (AnyColumn | ((table: TTable) => AnyColumn))[];

  /**
   * Search strategy to use. Defaults to universal lowercase LIKE.
   */
  searchStrategy?: SearchStrategy | 'like' | 'ilike' | 'tsvector';

  /**
   * Entity purpose name for cryptographic cursor token isolation (defaults to table name).
   */
  entityPurpose?: string;
}

/**
 * Resolved, immutable configuration for executing keyset queries on a table.
 */
export interface KeysetConfig<TTable extends Table = Table> {
  readonly table: TTable;
  readonly sortColumn: AnyColumn;
  readonly isAscending: boolean;
  readonly tieBreakerColumn: AnyColumn;
  readonly searchColumns: readonly AnyColumn[];
  readonly searchStrategy: SearchStrategy;
  readonly entityPurpose: string;
  readonly sortPropertyKey: string;
  readonly tieBreakerPropertyKey: string;
}
