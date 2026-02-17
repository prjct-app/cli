/**
 * JIRA Integration
 *
 * Provides JIRA issue tracking integration for prjct-cli via MCP.
 */

// Cache utilities
export {
  assignedIssuesCache,
  clearJiraCache,
  getJiraCacheStats,
  issueCache,
  projectsCache,
} from './cache'
// MCP client
export { type JiraAuthMode, JiraProvider, jiraProvider } from './client'
// Service layer with caching (preferred API)
export { JiraService, jiraService } from './service'
