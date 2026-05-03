/**
 * Read-only query helpers + clear/has on StateStorage. Extracted to
 * keep the facade focused on lifecycle mutations.
 */

import type { PreviousTask, StateJson, TaskHistoryEntry } from '../../schemas/state'
import { getTimestamp } from '../../utils/date-helper'

export interface QueryBackend {
  read(projectId: string): Promise<StateJson>
  update(projectId: string, fn: (s: StateJson) => StateJson): Promise<StateJson>
  getPausedTasksFromState(state: StateJson): PreviousTask[]
  getTaskHistoryFromState(state: StateJson): TaskHistoryEntry[]
}

export async function clearTask(backend: QueryBackend, projectId: string): Promise<void> {
  await backend.update(projectId, () => ({
    currentTask: null,
    previousTask: null,
    pausedTasks: [],
    activeTasks: [],
    lastUpdated: getTimestamp(),
  }))
}

export async function hasTask(backend: QueryBackend, projectId: string): Promise<boolean> {
  const state = await backend.read(projectId)
  const paused = backend.getPausedTasksFromState(state)
  return state.currentTask !== null || paused.length > 0
}

export async function getPausedTask(
  backend: QueryBackend,
  projectId: string
): Promise<PreviousTask | null> {
  const state = await backend.read(projectId)
  const paused = backend.getPausedTasksFromState(state)
  return paused[0] || null
}

export async function getAllPausedTasks(
  backend: QueryBackend,
  projectId: string
): Promise<PreviousTask[]> {
  const state = await backend.read(projectId)
  return backend.getPausedTasksFromState(state)
}

export async function getTaskHistory(
  backend: QueryBackend,
  projectId: string
): Promise<TaskHistoryEntry[]> {
  const state = await backend.read(projectId)
  return backend.getTaskHistoryFromState(state)
}

export async function getMostRecentTask(
  backend: QueryBackend,
  projectId: string
): Promise<TaskHistoryEntry | null> {
  const state = await backend.read(projectId)
  const history = backend.getTaskHistoryFromState(state)
  return history[0] || null
}

export async function getTaskHistoryByType(
  backend: QueryBackend,
  projectId: string,
  classification: TaskHistoryEntry['classification']
): Promise<TaskHistoryEntry[]> {
  const state = await backend.read(projectId)
  const history = backend.getTaskHistoryFromState(state)
  return history.filter((t) => t.classification === classification)
}

/**
 * Aggregate feedback from all task history entries (PRJ-272).
 * Used by sync to feed task discoveries back into analysis and agent
 * generation. Returns consolidated patterns, stack confirmations, issues,
 * and agent accuracy. Recurring issues (≥2 occurrences) get promoted to
 * known gotchas.
 */
export async function getAggregatedFeedback(
  backend: QueryBackend,
  projectId: string
): Promise<{
  stackConfirmed: string[]
  patternsDiscovered: string[]
  agentAccuracy: Array<{ agent: string; rating: string; note?: string }>
  issuesEncountered: string[]
  knownGotchas: string[]
}> {
  const history = await getTaskHistory(backend, projectId)
  const entriesWithFeedback = history.filter((h) => h.feedback)

  const stackConfirmed: string[] = []
  const patternsDiscovered: string[] = []
  const agentAccuracy: Array<{ agent: string; rating: string; note?: string }> = []
  const allIssues: string[] = []

  for (const entry of entriesWithFeedback) {
    const fb = entry.feedback!
    if (Array.isArray(fb.stackConfirmed)) stackConfirmed.push(...fb.stackConfirmed)
    if (Array.isArray(fb.patternsDiscovered)) patternsDiscovered.push(...fb.patternsDiscovered)
    if (Array.isArray(fb.agentAccuracy)) agentAccuracy.push(...fb.agentAccuracy)
    if (Array.isArray(fb.issuesEncountered)) allIssues.push(...fb.issuesEncountered)
  }

  const uniqueStack = [...new Set(stackConfirmed)]
  const uniquePatterns = [...new Set(patternsDiscovered)]

  const issueCounts = new Map<string, number>()
  for (const issue of allIssues) {
    issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1)
  }
  const knownGotchas = [...issueCounts.entries()]
    .filter(([_, count]) => count >= 2)
    .map(([issue]) => issue)

  return {
    stackConfirmed: uniqueStack,
    patternsDiscovered: uniquePatterns,
    agentAccuracy,
    issuesEncountered: [...new Set(allIssues)],
    knownGotchas,
  }
}
