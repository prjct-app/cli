/**
 * Storage Layer (PRJ-303: SQLite primary)
 *
 * All data stored in SQLite (prjct.db). Context MD files regenerated on write.
 *
 * 1. AGGREGATE STORAGE (StorageManager)
 *    Writes to SQLite kv_store + regenerates MD for Claude
 *    - stateStorage: kv_store['state'] → context/now.md
 *    - queueStorage: kv_store['queue'] → context/next.md
 *    - ideasStorage: kv_store['ideas'] → context/ideas.md
 *    - shippedStorage: kv_store['shipped'] → context/shipped.md
 *
 * 2. INDEX STORAGE
 *    Project scanning data in SQLite index_meta table
 *    - indexStorage: index_meta['project-index'], index_meta['checksums'], etc.
 *
 * 3. SQLITE DATABASE
 *    Single SQLite DB per project — source of truth
 *    - prjctDb: ~/.prjct-cli/projects/{projectId}/prjct.db
 *
 * Structure:
 * ~/.prjct-cli/projects/{projectId}/
 * ├── prjct.db              # SQLite database (source of truth)
 * ├── context/              # Generated MD (for Claude)
 * │   ├── CLAUDE.md
 * │   ├── now.md
 * │   ├── next.md
 * │   ├── ideas.md
 * │   └── shipped.md
 * ├── storage/backup/       # Pre-migration backup (one-time)
 * └── sync/                 # Backend sync
 *     ├── pending.json
 *     └── last-sync.json
 */

export type {
  AgentUsage,
  DailyStats,
  Idea,
  IdeaPriority,
  IdeaStatus,
  IdeasJson,
  MetricsJson,
  ShippedFeature,
  ShippedJson,
  Storage,
} from '../types'
export type { AnalysisStoreData, SealResult, StalenessCheck } from './analysis-storage'
export { analysisStorage } from './analysis-storage'
export type { Migration, MigrationRecord } from './database'
export { PrjctDatabase, prjctDb } from './database'
export { ideasStorage } from './ideas-storage'
export type {
  CategoriesCache,
  ConfigFileEntry,
  DetectedPattern,
  DetectedStack,
  DirectoryEntry,
  DiscoveredDomains,
  DomainDefinition,
  FileCategory,
  FileChecksums,
  LanguageStats,
  ProjectIndex,
  ScoredFile,
} from './index-storage'
export { getDefaultChecksums, getDefaultIndex, INDEX_VERSION, indexStorage } from './index-storage'
export { metricsStorage } from './metrics-storage'
export type { MigrationResult } from './migrate-json'
export { migrateJsonToSqlite } from './migrate-json'
export { queueStorage } from './queue-storage'
export { shippedStorage } from './shipped-storage'
export { stateStorage } from './state-storage'
export { getStorage } from './storage'
export { StorageManager } from './storage-manager'
export type { VelocityStoreData } from './velocity-storage'
export { velocityStorage } from './velocity-storage'
