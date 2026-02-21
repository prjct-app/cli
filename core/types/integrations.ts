/**
 * Integration Types
 * Types for external service integrations (Issue Trackers: Linear, JIRA)
 */

/**
 * Issue Tracker Config (Linear, Jira, etc.)
 * Re-exported from issue-tracker module
 */
export type {
  GitHubConfig,
  IssueTrackerConfig,
  JiraConfig,
  LinearConfig,
  MondayConfig,
} from '../integrations/issue-tracker/types'

export {
  DEFAULT_JIRA_CONFIG,
  DEFAULT_LINEAR_CONFIG,
} from '../integrations/issue-tracker/types'

/**
 * Integrations Config
 * Container for all external integrations
 */
export interface IntegrationsConfig {
  issueTracker?: import('../integrations/issue-tracker/types').IssueTrackerConfig
  linear?: import('../integrations/issue-tracker/types').LinearConfig
  jira?: import('../integrations/issue-tracker/types').JiraConfig
}

// =============================================================================
// Issue Enricher Types
// =============================================================================

export interface IssueEnricherProjectContext {
  name: string
  techStack: string[]
  keyDirectories: string[]
  recentCommits?: string[]
  patterns?: Record<string, string>
}

export interface EnrichmentResult {
  description: string
  acceptanceCriteria: string[]
  affectedFiles: string[]
  technicalNotes: string
  estimatedComplexity: 'trivial' | 'small' | 'medium' | 'large' | 'epic'
  suggestedApproach?: string
  relatedCode?: Array<{ file: string; relevance: string }>
}
