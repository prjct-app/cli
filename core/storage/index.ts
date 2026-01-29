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

// Re-export types from canonical location
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
export { ideasStorage } from './ideas-storage'
export type {
  CategoriesCache,
  ConfigFileEntry,
  DetectedPattern,
  DetectedStack,
  DirectoryEntry,
  DiscoveredDomains,
  // Smart Context Selection types (PRJ-85)
  DomainDefinition,
  FileCategory,
  FileChecksums,
  LanguageStats,
  ProjectIndex,
  ScoredFile,
} from './index-storage'
// ========== INDEX STORAGE (Project scanning) ==========
export { getDefaultChecksums, getDefaultIndex, INDEX_VERSION, indexStorage } from './index-storage'
export { metricsStorage } from './metrics-storage'
export { queueStorage } from './queue-storage'
export { shippedStorage } from './shipped-storage'
export { stateStorage } from './state-storage'

// ========== GRANULAR STORAGE (Legacy) ==========
export { default, getStorage } from './storage'
// ========== AGGREGATE STORAGE (Recommended) ==========
export { StorageManager } from './storage-manager'
