/**
 * JIRA Integration
 *
 * Provides JIRA issue tracking integration for prjct-cli.
 *
 * Environment Variables:
 * - JIRA_BASE_URL: Your JIRA instance URL (e.g., https://company.atlassian.net)
 * - JIRA_EMAIL: Your Atlassian account email
 * - JIRA_API_TOKEN: API token from https://id.atlassian.com/manage-profile/security/api-tokens
 */

export { JiraProvider, jiraProvider } from './client'
