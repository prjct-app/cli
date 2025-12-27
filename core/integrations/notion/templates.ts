/**
 * Notion Database Templates
 * Schemas for auto-creating prjct databases in Notion.
 */

import type { NotionDatabaseSchema } from './client'

// =============================================================================
// Database Schemas
// =============================================================================

/**
 * Shipped Features Database Schema
 * Tracks shipped features with metrics
 */
export const SHIPPED_DATABASE_SCHEMA: NotionDatabaseSchema = {
  title: 'prjct: Shipped Features',
  properties: {
    Name: { type: 'title', title: {} },
    Version: { type: 'rich_text', rich_text: {} },
    Type: {
      type: 'select',
      select: {
        options: [
          { name: 'feature', color: 'blue' },
          { name: 'fix', color: 'red' },
          { name: 'improvement', color: 'green' },
          { name: 'refactor', color: 'purple' },
        ],
      },
    },
    'Shipped Date': { type: 'date', date: {} },
    'Lines Changed': { type: 'number', number: { format: 'number' } },
    'Files Changed': { type: 'number', number: { format: 'number' } },
    Commits: { type: 'number', number: { format: 'number' } },
    Duration: { type: 'rich_text', rich_text: {} },
    Description: { type: 'rich_text', rich_text: {} },
  },
}

/**
 * Roadmap Database Schema
 * Tracks feature roadmap and progress
 */
export const ROADMAP_DATABASE_SCHEMA: NotionDatabaseSchema = {
  title: 'prjct: Roadmap',
  properties: {
    Feature: { type: 'title', title: {} },
    Status: {
      type: 'status',
      status: {
        options: [
          { name: 'Planned', color: 'gray' },
          { name: 'Active', color: 'blue' },
          { name: 'Completed', color: 'green' },
          { name: 'Shipped', color: 'purple' },
        ],
        groups: [
          { name: 'To Do', option_ids: [], color: 'gray' },
          { name: 'In Progress', option_ids: [], color: 'blue' },
          { name: 'Done', option_ids: [], color: 'green' },
        ],
      },
    },
    Priority: {
      type: 'select',
      select: {
        options: [
          { name: 'High', color: 'red' },
          { name: 'Medium', color: 'yellow' },
          { name: 'Low', color: 'gray' },
        ],
      },
    },
    Progress: { type: 'number', number: { format: 'percent' } },
    Phase: { type: 'rich_text', rich_text: {} },
    'Target Date': { type: 'date', date: {} },
    Description: { type: 'rich_text', rich_text: {} },
    Tasks: { type: 'number', number: { format: 'number' } },
  },
}

/**
 * Ideas Database Schema
 * Captures and tracks ideas
 */
export const IDEAS_DATABASE_SCHEMA: NotionDatabaseSchema = {
  title: 'prjct: Ideas',
  properties: {
    Idea: { type: 'title', title: {} },
    Status: {
      type: 'status',
      status: {
        options: [
          { name: 'Pending', color: 'gray' },
          { name: 'Converted', color: 'green' },
          { name: 'Archived', color: 'default' },
        ],
        groups: [
          { name: 'Not Started', option_ids: [], color: 'gray' },
          { name: 'Done', option_ids: [], color: 'green' },
        ],
      },
    },
    Priority: {
      type: 'select',
      select: {
        options: [
          { name: 'high', color: 'red' },
          { name: 'medium', color: 'yellow' },
          { name: 'low', color: 'gray' },
        ],
      },
    },
    Tags: { type: 'multi_select', multi_select: { options: [] } },
    Created: { type: 'date', date: {} },
    'Converted To': { type: 'rich_text', rich_text: {} },
  },
}

/**
 * Active Tasks Database Schema
 * Tracks current task queue
 */
export const TASKS_DATABASE_SCHEMA: NotionDatabaseSchema = {
  title: 'prjct: Active Tasks',
  properties: {
    Task: { type: 'title', title: {} },
    Priority: {
      type: 'select',
      select: {
        options: [
          { name: 'critical', color: 'red' },
          { name: 'high', color: 'orange' },
          { name: 'medium', color: 'yellow' },
          { name: 'low', color: 'gray' },
        ],
      },
    },
    Type: {
      type: 'select',
      select: {
        options: [
          { name: 'feature', color: 'blue' },
          { name: 'bug', color: 'red' },
          { name: 'improvement', color: 'green' },
          { name: 'chore', color: 'gray' },
        ],
      },
    },
    Section: {
      type: 'select',
      select: {
        options: [
          { name: 'active', color: 'blue' },
          { name: 'backlog', color: 'gray' },
        ],
      },
    },
    Completed: { type: 'checkbox', checkbox: {} },
    Agent: { type: 'rich_text', rich_text: {} },
    Feature: { type: 'rich_text', rich_text: {} },
    Created: { type: 'date', date: {} },
    'Completed At': { type: 'date', date: {} },
  },
}

// =============================================================================
// Dashboard Template
// =============================================================================

export interface DashboardMetrics {
  shippedCount: number
  ideasPending: number
  tasksActive: number
  roadmapProgress: number // 0-100
}

/**
 * Dashboard page content template with metrics
 */
export function getDashboardContent(
  projectName: string,
  databases: {
    shipped?: string
    roadmap?: string
    ideas?: string
    tasks?: string
  },
  metrics?: DashboardMetrics
): string {
  const sections: string[] = []

  sections.push(`# ${projectName} Dashboard`)
  sections.push('')

  // Metrics section
  if (metrics) {
    sections.push('## Metrics')
    sections.push('')
    sections.push('| Metric | Value |')
    sections.push('|--------|-------|')
    sections.push(`| Features Shipped | ${metrics.shippedCount} |`)
    sections.push(`| Ideas Pending | ${metrics.ideasPending} |`)
    sections.push(`| Active Tasks | ${metrics.tasksActive} |`)
    sections.push(`| Roadmap Progress | ${metrics.roadmapProgress}% |`)
    sections.push('')
  } else {
    sections.push('*Metrics will appear after first sync*')
    sections.push('')
  }

  // Database links
  sections.push('## Databases')
  sections.push('')

  if (databases.shipped) {
    sections.push(`- **Shipped Features**: Track released features and metrics`)
  }
  if (databases.roadmap) {
    sections.push(`- **Roadmap**: Feature planning and progress`)
  }
  if (databases.ideas) {
    sections.push(`- **Ideas**: Captured ideas and status`)
  }
  if (databases.tasks) {
    sections.push(`- **Active Tasks**: Current task queue`)
  }

  sections.push('')
  sections.push('---')
  sections.push('Synced by [prjct-cli](https://prjct.app)')

  return sections.join('\n')
}

// =============================================================================
// All Schemas Export
// =============================================================================

export const ALL_DATABASE_SCHEMAS = {
  shipped: SHIPPED_DATABASE_SCHEMA,
  roadmap: ROADMAP_DATABASE_SCHEMA,
  ideas: IDEAS_DATABASE_SCHEMA,
  tasks: TASKS_DATABASE_SCHEMA,
} as const
