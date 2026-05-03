/**
 * Pause / resume / archive helpers for the active task. Extracted to
 * keep the StateStorage facade small.
 */

import { generateUUID } from '../../schemas/schemas'
import type { CurrentTask, PreviousTask, StateJson } from '../../schemas/state'
import { getTimestamp } from '../../utils/date-helper'
import { archiveStorage } from '../archive-storage'

export interface LifecycleBackend {
  read(projectId: string): Promise<StateJson>
  update(projectId: string, fn: (s: StateJson) => StateJson): Promise<StateJson>
  publish(projectId: string, type: string, data: Record<string, unknown>): Promise<void>
  validateTransition(state: StateJson, transition: 'pause' | 'resume'): void
  getPausedTasksFromState(state: StateJson): PreviousTask[]
  maxPausedTasks: number
  stalenessThresholdDays: number
}

export async function pauseTask(
  backend: LifecycleBackend,
  projectId: string,
  reason?: string
): Promise<PreviousTask | null> {
  const state = await backend.read(projectId)
  if (!state.currentTask) return null

  backend.validateTransition(state, 'pause')

  const pausedTask: PreviousTask = {
    ...state.currentTask,
    status: 'paused',
    pausedAt: getTimestamp(),
    pauseReason: reason,
  }

  const existingPaused = backend.getPausedTasksFromState(state)
  // Enforce max paused limit
  const pausedTasks = [pausedTask, ...existingPaused].slice(0, backend.maxPausedTasks)

  await backend.update(projectId, (existingState) => ({
    ...existingState,
    currentTask: null,
    previousTask: null, // deprecated, keep null for compat
    pausedTasks,
    lastUpdated: getTimestamp(),
  }))

  await backend.publish(projectId, 'task.paused', {
    taskId: pausedTask.id,
    description: pausedTask.description,
    pausedAt: pausedTask.pausedAt,
    reason,
    pausedCount: pausedTasks.length,
  })

  return pausedTask
}

export async function resumeTask(
  backend: LifecycleBackend,
  projectId: string,
  taskId?: string
): Promise<CurrentTask | null> {
  const state = await backend.read(projectId)

  const pausedTasks = backend.getPausedTasksFromState(state)
  if (pausedTasks.length === 0) return null

  backend.validateTransition(state, 'resume')

  let targetIndex = 0
  if (taskId) {
    targetIndex = pausedTasks.findIndex((t) => t.id === taskId)
    if (targetIndex === -1) return null
  }

  const target = pausedTasks[targetIndex]
  const remaining = pausedTasks.filter((_, i) => i !== targetIndex)

  const { status: _, pausedAt: __, pauseReason: ___, ...preserved } = target
  const currentTask: CurrentTask = {
    ...preserved,
    startedAt: getTimestamp(),
    sessionId: target.sessionId ?? generateUUID(),
  }

  await backend.update(projectId, (existingState) => ({
    ...existingState,
    currentTask,
    previousTask: null,
    pausedTasks: remaining,
    lastUpdated: getTimestamp(),
  }))

  await backend.publish(projectId, 'task.resumed', {
    taskId: currentTask.id,
    description: currentTask.description,
    resumedAt: currentTask.startedAt,
    remainingPaused: remaining.length,
  })

  return currentTask
}

export async function getStalePausedTasks(
  backend: LifecycleBackend,
  projectId: string
): Promise<PreviousTask[]> {
  const state = await backend.read(projectId)
  const pausedTasks = backend.getPausedTasksFromState(state)
  const threshold = Date.now() - backend.stalenessThresholdDays * 24 * 60 * 60 * 1000

  return pausedTasks.filter((t) => new Date(t.pausedAt).getTime() < threshold)
}

/**
 * Archive stale paused tasks (PRJ-267). Persists to archive table before
 * removing from active storage. Returns archived tasks.
 */
export async function archiveStalePausedTasks(
  backend: LifecycleBackend,
  projectId: string
): Promise<PreviousTask[]> {
  const state = await backend.read(projectId)
  const pausedTasks = backend.getPausedTasksFromState(state)
  const threshold = Date.now() - backend.stalenessThresholdDays * 24 * 60 * 60 * 1000

  const stale = pausedTasks.filter((t) => new Date(t.pausedAt).getTime() < threshold)
  const fresh = pausedTasks.filter((t) => new Date(t.pausedAt).getTime() >= threshold)

  if (stale.length === 0) return []

  archiveStorage.archiveMany(
    projectId,
    stale.map((task) => ({
      entityType: 'paused_task' as const,
      entityId: task.id,
      entityData: task,
      summary: task.description,
      reason: 'staleness',
    }))
  )

  await backend.update(projectId, (s) => ({
    ...s,
    pausedTasks: fresh,
    previousTask: null,
    lastUpdated: getTimestamp(),
  }))

  for (const task of stale) {
    await backend.publish(projectId, 'task.archived', {
      taskId: task.id,
      description: task.description,
      pausedAt: task.pausedAt,
      reason: 'staleness',
    })
  }

  return stale
}
