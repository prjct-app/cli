/**
 * Task Dispatcher - Assigns tasks to parallel agent sessions
 *
 * Supports multiple dispatch sources:
 * 1. **Queue** (native) — takes N tasks from prjct backlog, no external tracker needed
 * 2. **Manual** — batch-spawn from a list of task descriptions
 * 3. **Linear/Jira** (MCP) — fetch tickets from issue trackers
 *
 * The dispatcher is agent-driven: it generates plans, the agent or CLI
 * creates worktrees and assigns tasks to workspaces.
 *
 * @module services/ticket-dispatcher
 */

import { queueStorage } from '../storage/queue-storage'
import { sortBySectionAndPriority } from '../utils/collection-filters'

// =============================================================================
// Types
// =============================================================================

export interface DispatchItem {
  /** Unique ID — queue task ID, issue key (PRJ-123), or generated slug */
  id: string
  /** Task description / title */
  title: string
  /** Priority level */
  priority?: string
  /** Fibonacci estimation */
  estimatedPoints?: number
  /** Where this item came from */
  source: DispatchSource
  /** Linear issue ID if from Linear */
  linearId?: string
  /** Jira issue key if from Jira */
  jiraId?: string
  /** Queue task ID if from queue */
  queueTaskId?: string
  /** Assigned workspace ID (set after dispatch) */
  assignedWorkspace?: string
}

export type DispatchSource = 'queue' | 'manual' | 'linear' | 'jira'

export interface DispatchPlan {
  items: DispatchItem[]
  source: DispatchSource
  strategy: DispatchStrategy
  maxAgents: number
  createdAt: string
}

export type DispatchStrategy =
  | 'round-robin'
  | 'priority-first'
  | 'dependency-aware'
  | 'estimate-balanced'

// =============================================================================
// Task Dispatcher
// =============================================================================

class TaskDispatcher {
  // ===========================================================================
  // Source: Queue (native — no external tracker needed)
  // ===========================================================================

  /**
   * Create a dispatch plan from the prjct queue/backlog.
   * Takes the top N active tasks sorted by priority.
   */
  async planFromQueue(
    projectId: string,
    options: { maxAgents?: number; strategy?: DispatchStrategy; includeBacklog?: boolean } = {}
  ): Promise<DispatchPlan> {
    const max = options.maxAgents || 10

    // Get tasks from queue
    const activeTasks = await queueStorage.getActiveTasks(projectId)
    const backlogTasks = options.includeBacklog ? await queueStorage.getBacklog(projectId) : []
    const allTasks = [...activeTasks, ...backlogTasks]

    // Sort by priority
    const sorted = sortBySectionAndPriority(allTasks)
      .filter((t) => !t.completed)
      .slice(0, max)

    const items: DispatchItem[] = sorted.map((t) => ({
      id: t.id,
      title: t.description,
      priority: t.priority,
      source: 'queue' as const,
      queueTaskId: t.id,
    }))

    return this.buildPlan(items, 'queue', options)
  }

  // ===========================================================================
  // Source: Manual (inline task descriptions)
  // ===========================================================================

  /**
   * Create a dispatch plan from a list of task descriptions.
   * No external tracker needed — just strings.
   */
  planFromDescriptions(
    descriptions: string[],
    options: { maxAgents?: number; strategy?: DispatchStrategy } = {}
  ): DispatchPlan {
    const max = options.maxAgents || descriptions.length

    const items: DispatchItem[] = descriptions.slice(0, max).map((desc, i) => ({
      id: `manual-${i + 1}`,
      title: desc,
      source: 'manual' as const,
    }))

    return this.buildPlan(items, 'manual', options)
  }

  // ===========================================================================
  // Source: Linear/Jira (MCP — generates fetch instructions for agent)
  // ===========================================================================

  /**
   * Generate MCP fetch instructions for the orchestrating agent.
   * The agent executes these MCP tools and feeds the results back to createPlan.
   */
  generateFetchInstructions(
    provider: 'linear' | 'jira',
    filters: {
      sprint?: boolean
      backlog?: boolean
      labels?: string[]
      priority?: string
      maxResults?: number
    } = {}
  ): string {
    const max = filters.maxResults || 10

    if (provider === 'linear') {
      const filterParts: string[] = ['assignee: "me"', 'state: { type: { eq: "unstarted" } }']
      if (filters.labels?.length) {
        filterParts.push(
          `labels: { name: { in: [${filters.labels.map((l) => `"${l}"`).join(', ')}] } }`
        )
      }
      if (filters.priority) {
        const priorityMap: Record<string, number> = { urgent: 1, high: 2, medium: 3, low: 4 }
        const num = priorityMap[filters.priority]
        if (num) filterParts.push(`priority: { lte: ${num} }`)
      }

      return [
        'Use the Linear MCP tool `list_issues` with these parameters:',
        `- filter: { ${filterParts.join(', ')} }`,
        `- first: ${max}`,
        '- orderBy: "priority"',
        '',
        'Return the results as a JSON array with fields: id, identifier, title, priority, estimate.',
        'I will use this to create parallel worktrees for each ticket.',
      ].join('\n')
    }

    // Jira
    const jqlParts: string[] = ['assignee = currentUser()', 'statusCategory = "To Do"']
    if (filters.sprint) jqlParts.push('sprint in openSprints()')
    else if (filters.backlog) jqlParts.push('sprint is EMPTY')
    if (filters.labels?.length) jqlParts.push(`labels in (${filters.labels.join(', ')})`)
    if (filters.priority) jqlParts.push(`priority = "${filters.priority}"`)

    const jql = `${jqlParts.join(' AND ')} ORDER BY priority DESC`

    return [
      'Use the Jira MCP tool `searchJiraIssuesUsingJql` with:',
      `- jql: "${jql}"`,
      `- maxResults: ${max}`,
      '',
      'Return the results as a JSON array with fields: key, summary, priority, storyPoints.',
      'I will use this to create parallel worktrees for each ticket.',
    ].join('\n')
  }

  /**
   * Create a dispatch plan from tracker results (after agent fetches tickets).
   */
  planFromTracker(
    items: DispatchItem[],
    provider: 'linear' | 'jira',
    options: { maxAgents?: number; strategy?: DispatchStrategy } = {}
  ): DispatchPlan {
    return this.buildPlan(items, provider, options)
  }

  // ===========================================================================
  // Plan Building & Formatting
  // ===========================================================================

  private buildPlan(
    items: DispatchItem[],
    source: DispatchSource,
    options: { maxAgents?: number; strategy?: DispatchStrategy } = {}
  ): DispatchPlan {
    const maxAgents = options.maxAgents || items.length
    const strategy = options.strategy || 'priority-first'

    let sorted = [...items]

    if (strategy === 'priority-first') {
      const order: Record<string, number> = {
        urgent: 0,
        critical: 0,
        highest: 0,
        high: 1,
        medium: 2,
        normal: 2,
        low: 3,
        none: 4,
      }
      sorted.sort((a, b) => {
        const pa = order[a.priority?.toLowerCase() || 'none'] ?? 4
        const pb = order[b.priority?.toLowerCase() || 'none'] ?? 4
        return pa - pb
      })
    } else if (strategy === 'estimate-balanced') {
      sorted.sort((a, b) => (b.estimatedPoints || 0) - (a.estimatedPoints || 0))
    }

    sorted = sorted.slice(0, maxAgents)

    return {
      items: sorted,
      source,
      strategy,
      maxAgents,
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * Format a dispatch plan as markdown.
   */
  formatPlan(plan: DispatchPlan): string {
    const lines: string[] = [
      '## Dispatch Plan',
      '',
      `Source: **${plan.source}**`,
      `Strategy: **${plan.strategy}**`,
      `Tasks: **${plan.items.length}** (max agents: ${plan.maxAgents})`,
      '',
      '| # | ID | Task | Priority |',
      '|---|-----|------|----------|',
    ]

    for (let i = 0; i < plan.items.length; i++) {
      const t = plan.items[i]
      const id = t.linearId || t.jiraId || t.queueTaskId?.slice(0, 8) || t.id
      lines.push(`| ${i + 1} | ${id} | ${t.title.slice(0, 50)} | ${t.priority || '-'} |`)
    }

    lines.push('')
    lines.push('Run `prjct parallel dispatch` to create worktrees and start agents.')

    return lines.join('\n')
  }

  /**
   * Generate slug for worktree naming from a dispatch item.
   */
  slugify(item: DispatchItem): string {
    const base = item.linearId || item.jiraId || item.title
    return base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const taskDispatcher = new TaskDispatcher()
export default taskDispatcher
