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
