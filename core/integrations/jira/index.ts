/**
 * JIRA Integration
 *
 * Provides JIRA issue tracking integration for prjct-cli.
 *
 * Two authentication modes:
 *
 * 1. API Token Mode (direct REST API):
 *    - JIRA_BASE_URL: Your JIRA instance URL (e.g., https://company.atlassian.net)
 *    - JIRA_EMAIL: Your Atlassian account email
 *    - JIRA_API_TOKEN: API token from https://id.atlassian.com/manage-profile/security/api-tokens
 *
 * 2. MCP Mode (for corporate SSO):
 *    - No environment variables needed
 *    - Requires Atlassian MCP server configured in ~/.claude/mcp.json
 *    - Authenticates via browser (OAuth 2.1, SSO compatible)
 */

// REST API client (supports both API token and MCP modes)
export { JiraProvider, jiraProvider, type JiraAuthMode } from './client'

// MCP adapter for generating Claude instructions
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
