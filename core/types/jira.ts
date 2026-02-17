/**
 * JIRA Integration Types
 * Types for JIRA API client.
 */

export interface JiraIssue {
  id: string
  key: string
  self: string
  fields: {
    summary: string
    description?:
      | {
          type: string
          content: Array<{
            type: string
            content?: Array<{ type: string; text?: string }>[]
          }>
        }
      | string
      | null
    status: {
      id: string
      name: string
      statusCategory: { key: string; name: string }
    }
    priority?: { id: string; name: string }
    issuetype: { id: string; name: string; subtask: boolean }
    assignee?: { accountId: string; displayName: string; emailAddress?: string }
    reporter?: { accountId: string; displayName: string; emailAddress?: string }
    project: { id: string; key: string; name: string }
    labels: string[]
    created: string
    updated: string
  }
}

export interface JiraSearchResponse {
  issues: JiraIssue[]
  total: number
  maxResults: number
  startAt: number
}

export interface JiraProject {
  id: string
  key: string
  name: string
}

export type JiraAuthMode = 'mcp' | 'none'
