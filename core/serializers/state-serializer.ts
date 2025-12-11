/**
 * State Serializer
 *
 * Parses and serializes now.md for current task state.
 *
 * MD Format (now.md):
 * ```
 * # NOW
 *
 * **Task description here**
 *
 * Started: 2025-12-10T10:00:00.000Z
 * Session: sess_abc123
 * Feature: feat_xyz789
 * Agent: fe
 * ```
 */

import type { StateJson, CurrentTask, PreviousTask } from '../schemas/state'

/**
 * Parse now.md content to StateJson
 */
export function parseState(content: string): StateJson {
  if (!content || !content.trim()) {
    return { currentTask: null, lastUpdated: '' }
  }

  const lines = content.split('\n')
  let currentTask: CurrentTask | null = null
  let previousTask: PreviousTask | null = null

  // Find task description (bold line after # NOW)
  let description = ''
  for (const line of lines) {
    const boldMatch = line.match(/^\*\*(.+)\*\*$/)
    if (boldMatch) {
      description = boldMatch[1].trim()
      break
    }
  }

  if (!description || description.toLowerCase().includes('no active task')) {
    return { currentTask: null, lastUpdated: '' }
  }

  // Extract metadata
  const startedMatch = content.match(/Started:\s*(.+)/i)
  const sessionMatch = content.match(/Session:\s*(.+)/i)
  const featureMatch = content.match(/Feature:\s*(.+)/i)
  const idMatch = content.match(/ID:\s*(.+)/i)
  const agentMatch = content.match(/Agent:\s*(.+)/i)
  const pausedMatch = content.match(/Paused:\s*(.+)/i)

  const id = idMatch ? idMatch[1].trim() : `task_${Date.now()}`
  const startedAt = startedMatch ? startedMatch[1].trim() : new Date().toISOString()
  const sessionId = sessionMatch ? sessionMatch[1].trim() : `sess_${Date.now()}`

  if (pausedMatch) {
    // This is a paused task
    previousTask = {
      id,
      description,
      status: 'paused',
      startedAt,
      pausedAt: pausedMatch[1].trim()
    }
  } else {
    // Active task
    currentTask = {
      id,
      description,
      startedAt,
      sessionId
    }

    if (featureMatch) {
      currentTask.featureId = featureMatch[1].trim()
    }
  }

  return {
    currentTask,
    previousTask,
    lastUpdated: startedAt
  }
}

/**
 * Serialize StateJson to now.md format
 */
export function serializeState(data: StateJson): string {
  const lines: string[] = ['# NOW', '']

  if (!data.currentTask && !data.previousTask) {
    lines.push('_No active task_', '')
    lines.push('Use `/p:now` to start working on something.')
    return lines.join('\n')
  }

  const task = data.currentTask || data.previousTask

  if (task) {
    lines.push(`**${task.description}**`, '')

    if ('pausedAt' in task && task.pausedAt) {
      lines.push(`Started: ${task.startedAt}`)
      lines.push(`Paused: ${task.pausedAt}`)
    } else if (data.currentTask) {
      lines.push(`Started: ${data.currentTask.startedAt}`)
      lines.push(`Session: ${data.currentTask.sessionId}`)
      if (data.currentTask.featureId) {
        lines.push(`Feature: ${data.currentTask.featureId}`)
      }
    }
  }

  return lines.join('\n')
}

/**
 * Quick helpers for common operations
 */
export function createCurrentTaskMd(task: CurrentTask): string {
  return serializeState({
    currentTask: task,
    lastUpdated: task.startedAt
  })
}

export function createEmptyStateMd(): string {
  return serializeState({
    currentTask: null,
    lastUpdated: ''
  })
}
