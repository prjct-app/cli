/**
 * Notion Integration Module
 * Optional integration with Notion for syncing prjct data.
 */

// Client
export { NotionClient, notionClient } from './client'
export type {
  NotionDatabase,
  NotionPage,
  NotionProperty,
  NotionDatabaseSchema,
  NotionQueryFilter,
} from './client'

// Templates
export {
  SHIPPED_DATABASE_SCHEMA,
  ROADMAP_DATABASE_SCHEMA,
  IDEAS_DATABASE_SCHEMA,
  TASKS_DATABASE_SCHEMA,
  ALL_DATABASE_SCHEMAS,
  getDashboardContent,
} from './templates'

// Sync
export {
  syncShippedFeature,
  syncIdea,
  fullSync,
  pullShippedFeatures,
  pullIdeas,
  bidirectionalSync,
} from './sync'
export type { SyncResult, PullResult } from './sync'

// Setup
export {
  checkNotionMCPAvailable,
  validateToken,
  createDatabases,
  setupNotion,
  getSetupInstructions,
  parseNotionPageUrl,
} from './setup'
export type { SetupResult, ValidationResult } from './setup'
