/**
 * Linear Integration
 * Issue tracker provider for Linear using @linear/sdk
 */

// Core provider
export { LinearProvider, linearProvider } from './client'

// Service layer with caching (preferred API)
export { LinearService, linearService } from './service'

// Cache utilities
export {
  issueCache,
  assignedIssuesCache,
  teamsCache,
  projectsCache,
  clearLinearCache,
  getLinearCacheStats,
} from './cache'
