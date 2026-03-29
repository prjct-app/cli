/**
 * Session Grounding (ELI16 Mode)
 *
 * When 3+ agent sessions are active simultaneously, generates
 * a context preamble so each agent knows:
 * - Which workspace/branch/task it owns
 * - What other agents are doing
 * - Coordination rules (independent, merge at PR time)
 *
 * Inspired by gstack's ELI16 mode.
 *
 * @module agentic/session-grounding
 */

import { stateStorage } from '../storage/state-storage'

// =============================================================================
// Types
// =============================================================================

export interface GroundingContext {
  /** Info about the current session */
  thisSession: {
    workspaceId: string
    branch?: string
    taskDescription: string
    linearId?: string
    jiraId?: string
  }
  /** Info about other active sessions */
  otherSessions: Array<{
    workspaceId: string
    branch?: string
    taskSummary: string
  }>
  /** Coordination instructions for the agent */
  coordination: string
  /** Total active session count */
  totalSessions: number
}

// =============================================================================
// Constants
// =============================================================================

/** Minimum active sessions before grounding kicks in */
const ELI16_THRESHOLD = 3

const COORDINATION_MESSAGE =
  'You are working independently in your own git worktree. ' +
  'Do NOT modify files outside your worktree. ' +
  'Merge conflicts will be resolved at PR time. ' +
  'Focus on your task only.'

// =============================================================================
// Functions
// =============================================================================

/**
 * Check if grounding context should be generated.
 */
export async function shouldGround(projectId: string): Promise<boolean> {
  const count = await stateStorage.getActiveTaskCount(projectId)
  return count >= ELI16_THRESHOLD
}

/**
 * Generate grounding context for a specific workspace.
 */
export async function generateGrounding(
  projectId: string,
  workspaceId: string
): Promise<GroundingContext | null> {
  const activeTasks = await stateStorage.getActiveTasks(projectId)

  if (activeTasks.length < ELI16_THRESHOLD) {
    return null
  }

  const thisTask = activeTasks.find((t) => t.workspaceId === workspaceId)
  if (!thisTask) {
    return null
  }

  const otherTasks = activeTasks.filter((t) => t.workspaceId !== workspaceId)

  return {
    thisSession: {
      workspaceId: thisTask.workspaceId,
      branch: thisTask.branch,
      taskDescription: thisTask.description,
      linearId: thisTask.linearId,
      jiraId: thisTask.jiraId,
    },
    otherSessions: otherTasks.map((t) => ({
      workspaceId: t.workspaceId,
      branch: t.branch,
      taskSummary: truncate(t.description, 60),
    })),
    coordination: COORDINATION_MESSAGE,
    totalSessions: activeTasks.length,
  }
}

/**
 * Format grounding context as markdown for injection into agent prompts.
 */
export function formatGrounding(ctx: GroundingContext): string {
  const lines: string[] = [
    `## Session Context (${ctx.totalSessions} active agents)`,
    '',
    `You are working on: **${ctx.thisSession.taskDescription}**`,
  ]

  if (ctx.thisSession.branch) {
    lines.push(`Branch: \`${ctx.thisSession.branch}\``)
  }

  if (ctx.thisSession.linearId) {
    lines.push(`Ticket: ${ctx.thisSession.linearId}`)
  } else if (ctx.thisSession.jiraId) {
    lines.push(`Ticket: ${ctx.thisSession.jiraId}`)
  }

  if (ctx.otherSessions.length > 0) {
    lines.push('')
    lines.push('Other active agents:')
    for (const other of ctx.otherSessions) {
      const branch = other.branch ? ` \`${other.branch}\`` : ''
      lines.push(`- ${other.workspaceId.slice(0, 8)}${branch} — ${other.taskSummary}`)
    }
  }

  lines.push('')
  lines.push(`**Coordination**: ${ctx.coordination}`)

  return lines.join('\n')
}

// =============================================================================
// Helpers
// =============================================================================

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return `${str.slice(0, maxLen - 3)}...`
}
