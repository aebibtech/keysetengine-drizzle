// Core domain types
export type {
  PageDirection,
  KeysetRequest,
  KeysetPage,
  KeysetCursorToken,
  CursorProtector,
  SearchStrategy,
  KeysetConfigOptions,
  KeysetConfig,
} from './types.js';

// Configuration builder
export { createKeysetConfig } from './config.js';

// Cryptographic protectors and search hash utilities
export { Base64UrlCursorProtector } from './crypto/base64url-protector.js';
export {
  CryptoCursorProtector,
  type CryptoCursorProtectorOptions,
} from './crypto/crypto-protector.js';
export {
  computeSearchHash,
  matchesSearchHash,
} from './crypto/search-hash.js';

// Search strategies
export {
  likeSearchStrategy,
  ilikeSearchStrategy,
  postgresTsVectorSearchStrategy,
  resolveSearchStrategy,
} from './search/strategies.js';

// Expression builders
export {
  buildKeysetPredicate,
  buildSearchPredicate,
  coerceColumnValue,
  serializeColumnValue,
} from './expressions/keyset-builder.js';
export { buildKeysetOrderBy } from './expressions/order-builder.js';

// Execution pipeline and query builder
export {
  buildKeysetClause,
  formatKeysetPage,
  type KeysetQueryComponents,
  type KeysetExecutionOptions,
} from './query-builder.js';
export {
  paginateKeyset,
  type DrizzleSelectQuery,
} from './paginate.js';
