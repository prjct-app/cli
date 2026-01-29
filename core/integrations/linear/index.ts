/**
 * Linear Integration
 * Issue tracker provider for Linear using @linear/sdk
 */

// Core provider
export { LinearProvider, linearProvider } from './client'

// Service layer with caching (preferred API)
export { LinearService, linearService } from './service'

// Sync layer for bidirectional sync with issues.json
export { LinearSync, linearSync } from './sync'

// Cache utilities
export {
  issueCache,
  assignedIssuesCache,
  teamsCache,
  projectsCache,
  clearLinearCache,
  getLinearCacheStats,
} from './cache'
