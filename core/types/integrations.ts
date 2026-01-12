/**
 * Integration Types
 * Types for external service integrations (Notion, etc.)
 */

/**
 * Notion Integration Config
 * Stored in GlobalConfig.integrations.notion
 */
export interface NotionIntegrationConfig {
  enabled: boolean
  workspaceId?: string
  workspaceName?: string

  // Database IDs (created on first setup)
  databases: {
    shipped?: string // "prjct: Shipped Features"
    roadmap?: string // "prjct: Roadmap"
    ideas?: string // "prjct: Ideas"
    tasks?: string // "prjct: Active Tasks"
  }

  // Dashboard page (links all databases)
  dashboardPageId?: string

  // Sync preferences
  syncOn: {
    ship: boolean // Auto-sync on /p:ship
    done: boolean // Sync task completion
    idea: boolean // Sync new ideas
  }

  // Setup metadata
  setupAt?: string
  lastSyncAt?: string
}

/**
 * Issue Tracker Config (Linear, Jira, Monday, etc.)
 * Re-exported from issue-tracker module
 */
export type {
  IssueTrackerConfig,
  LinearConfig,
  JiraConfig,
  MondayConfig,
  GitHubConfig,
} from '../integrations/issue-tracker/types'

export {
  DEFAULT_LINEAR_CONFIG,
  DEFAULT_JIRA_CONFIG,
} from '../integrations/issue-tracker/types'

/**
 * Integrations Config
 * Container for all external integrations
 */
export interface IntegrationsConfig {
  notion?: NotionIntegrationConfig
  issueTracker?: import('../integrations/issue-tracker/types').IssueTrackerConfig
}

/**
 * Default Notion config (disabled)
 */
export const DEFAULT_NOTION_CONFIG: NotionIntegrationConfig = {
  enabled: false,
  databases: {},
  syncOn: {
    ship: true,
    done: false,
    idea: true,
  },
}
