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

// Cache utilities
export {
  assignedIssuesCache,
  clearJiraCache,
  getJiraCacheStats,
  issueCache,
  projectsCache,
} from './cache'
// REST API client
export { type JiraAuthMode, JiraProvider, jiraProvider } from './client'
// MCP adapter (deprecated - will be removed)
export {
  createCreateIssueInstruction,
  createGetIssueInstruction,
  // MCP instruction generators
  createSearchInstruction,
  createTransitionInstruction,
  createUpdateInstruction,
  getMCPSetupInstructions,
  // Utilities
  isMCPAvailable,
  JiraMCPAdapter,
  jiraMCPAdapter,
  type MCPInstruction,
} from './mcp-adapter'
// Service layer with caching (preferred API)
export { JiraService, jiraService } from './service'
