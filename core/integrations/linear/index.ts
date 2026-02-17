/**
 * Linear Integration
 * Issue tracker provider for Linear via MCP (OAuth in AI client)
 */

// Cache utilities
export {
  assignedIssuesCache,
  clearLinearCache,
  getLinearCacheStats,
  issueCache,
  projectsCache,
  teamsCache,
} from './cache'
// Core provider
export { LinearProvider, linearProvider } from './client'
// Service layer with caching (preferred API)
export { LinearService, linearService } from './service'
