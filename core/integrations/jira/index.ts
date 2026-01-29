/**
 * JIRA Integration
 *
 * Provides JIRA issue tracking integration for prjct-cli using REST API.
 *
 * Authentication (API Token Mode):
 *    - JIRA_BASE_URL: Your JIRA instance URL (e.g., https://company.atlassian.net)
 *    - JIRA_EMAIL: Your Atlassian account email
 *    - JIRA_API_TOKEN: API token from https://id.atlassian.com/manage-profile/security/api-tokens
 */

// REST API client
export { JiraProvider, jiraProvider, type JiraAuthMode } from './client'

// Service layer with caching (preferred API)
export { JiraService, jiraService } from './service'

// Cache utilities
export {
  issueCache,
  assignedIssuesCache,
  projectsCache,
  clearJiraCache,
  getJiraCacheStats,
} from './cache'

// MCP adapter (deprecated - will be removed)
export {
  JiraMCPAdapter,
  jiraMCPAdapter,
  // MCP instruction generators
  createSearchInstruction,
  createGetIssueInstruction,
  createTransitionInstruction,
  createUpdateInstruction,
  createCreateIssueInstruction,
  // Utilities
  isMCPAvailable,
  getMCPSetupInstructions,
  type MCPInstruction,
} from './mcp-adapter'
