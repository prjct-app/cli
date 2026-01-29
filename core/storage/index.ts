/**
 * Storage Layer
 *
 * Two storage patterns:
 *
 * 1. AGGREGATE STORAGE (Write-Through Pattern)
 *    For main state - writes JSON + regenerates MD + publishes events
 *    - stateStorage: storage/state.json → context/now.md
 *    - queueStorage: storage/queue.json → context/next.md
 *    - ideasStorage: storage/ideas.json → context/ideas.md
 *    - shippedStorage: storage/shipped.json → context/shipped.md
 *
 * 2. GRANULAR STORAGE (OpenCode-style) - Legacy
 *    For future per-entity storage
 *    - getStorage(projectId): data/{entity}s/{id}.json
 *
 * 3. INDEX STORAGE (New)
 *    For persistent project scanning with scoring
 *    - indexStorage: index/project-index.json, index/checksums.json
 *
 * Structure:
 * ~/.prjct-cli/projects/{projectId}/
 * ├── storage/              # Aggregate JSON (source of truth)
 * │   ├── state.json
 * │   ├── queue.json
 * │   ├── ideas.json
 * │   └── shipped.json
 * ├── context/              # Generated MD (for Claude)
 * │   ├── CLAUDE.md
 * │   ├── now.md
 * │   ├── next.md
 * │   ├── ideas.md
 * │   └── shipped.md
 * ├── index/                # Project index (persistent scan)
 * │   ├── project-index.json
 * │   ├── file-scores.json
 * │   └── checksums.json
 * ├── data/                 # Granular JSON (legacy/future)
 * │   └── ...
 * └── sync/                 # Backend sync
 *     ├── pending.json
 *     └── last-sync.json
 */

// ========== AGGREGATE STORAGE (Recommended) ==========
export { StorageManager } from './storage-manager'
export { stateStorage } from './state-storage'
export { queueStorage } from './queue-storage'
export { ideasStorage } from './ideas-storage'
export { shippedStorage } from './shipped-storage'
export { metricsStorage } from './metrics-storage'

// ========== INDEX STORAGE (Project scanning) ==========
export { indexStorage, INDEX_VERSION, getDefaultIndex, getDefaultChecksums } from './index-storage'
export type {
  ProjectIndex,
  LanguageStats,
  ConfigFileEntry,
  DirectoryEntry,
  ScoredFile,
  DetectedPattern,
  DetectedStack,
  FileChecksums,
  // Smart Context Selection types (PRJ-85)
  DomainDefinition,
  DiscoveredDomains,
  FileCategory,
  CategoriesCache,
} from './index-storage'

// ========== GRANULAR STORAGE (Legacy) ==========
export { getStorage, default } from './storage'

// Re-export types from canonical location
export type {
  Storage,
  Idea,
  IdeasJson,
  IdeaStatus,
  IdeaPriority,
  ShippedFeature,
  ShippedJson,
  DailyStats,
  AgentUsage,
  MetricsJson,
} from '../types'
