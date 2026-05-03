/**
 * Subtask lifecycle helpers for StateStorage.
 *
 * Functions take a `Backend` exposing the public `read`/`update` API
 * plus a typed `publish` proxy for the protected `publishEvent` method.
 * Keeps the `StateStorage` facade focused on routing while the heavy
 * subtask state machine lives here.
 */

import type { StateJson, Subtask, SubtaskCompletionData } from '../../schemas/state'
import { SubtaskCompletionDataSchema } from '../../schemas/state'
import { getTimestamp } from '../../utils/date-helper'

export interface SubtaskBackend {
  read(projectId: string): Promise<StateJson>
  update(projectId: string, fn: (s: StateJson) => StateJson): Promise<StateJson>
  publish(projectId: string, type: string, data: Record<string, unknown>): Promise<void>
}

export async function createSubtasks(
  backend: SubtaskBackend,
  projectId: string,
  subtasks: Omit<Subtask, 'status' | 'startedAt' | 'completedAt' | 'output' | 'summary'>[]
): Promise<void> {
  const state = await backend.read(projectId)
  if (!state.currentTask) return

  const fullSubtasks: Subtask[] = subtasks.map((s, index) => ({
    ...s,
    status: index === 0 ? 'in_progress' : 'pending',
    startedAt: index === 0 ? getTimestamp() : undefined,
    dependsOn: s.dependsOn || [],
  }))

  await backend.update(projectId, (current) => ({
    ...current,
    currentTask: {
      ...current.currentTask!,
      subtasks: fullSubtasks,
      currentSubtaskIndex: 0,
      subtaskProgress: {
        completed: 0,
        total: fullSubtasks.length,
        percentage: 0,
      },
    },
    lastUpdated: getTimestamp(),
  }))

  await backend.publish(projectId, 'subtasks.created', {
    taskId: state.currentTask.id,
    subtaskCount: fullSubtasks.length,
    subtasks: fullSubtasks.map((s) => ({
      id: s.id,
      description: s.description,
      domain: s.domain,
    })),
  })
}

export async function completeSubtask(
  backend: SubtaskBackend,
  projectId: string,
  completionData: SubtaskCompletionData
): Promise<Subtask | null> {
  const validation = SubtaskCompletionDataSchema.safeParse(completionData)
  if (!validation.success) {
    const errors = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(`Subtask completion requires handoff data:\n${errors.join('\n')}`)
  }

  const { output, summary } = validation.data
  const state = await backend.read(projectId)
  if (!state.currentTask?.subtasks) return null

  const currentIndex = state.currentTask.currentSubtaskIndex || 0
  const current = state.currentTask.subtasks[currentIndex]
  if (!current) return null

  const updatedSubtasks = [...state.currentTask.subtasks]
  updatedSubtasks[currentIndex] = {
    ...current,
    status: 'completed',
    completedAt: getTimestamp(),
    output,
    summary,
  }

  const completed = updatedSubtasks.filter((s) => s.status === 'completed').length
  const total = updatedSubtasks.length
  const percentage = Math.round((completed / total) * 100)

  const nextIndex = currentIndex + 1
  if (nextIndex < updatedSubtasks.length) {
    updatedSubtasks[nextIndex] = {
      ...updatedSubtasks[nextIndex],
      status: 'in_progress',
      startedAt: getTimestamp(),
    }
  }

  await backend.update(projectId, (s) => ({
    ...s,
    currentTask: {
      ...s.currentTask!,
      subtasks: updatedSubtasks,
      currentSubtaskIndex: nextIndex < total ? nextIndex : currentIndex,
      subtaskProgress: { completed, total, percentage },
    },
    lastUpdated: getTimestamp(),
  }))

  await backend.publish(projectId, 'subtask.completed', {
    taskId: state.currentTask.id,
    subtaskId: current.id,
    description: current.description,
    output,
    handoff: summary.outputForNextAgent,
    filesChanged: summary.filesChanged.length,
    progress: { completed, total, percentage },
  })

  return nextIndex < total ? updatedSubtasks[nextIndex] : null
}

export async function getCurrentSubtask(
  backend: SubtaskBackend,
  projectId: string
): Promise<Subtask | null> {
  const state = await backend.read(projectId)
  if (!state.currentTask?.subtasks) return null
  const index = state.currentTask.currentSubtaskIndex || 0
  return state.currentTask.subtasks[index] || null
}

export async function getNextSubtask(
  backend: SubtaskBackend,
  projectId: string
): Promise<Subtask | null> {
  const state = await backend.read(projectId)
  if (!state.currentTask?.subtasks) return null
  const nextIndex = (state.currentTask.currentSubtaskIndex || 0) + 1
  return state.currentTask.subtasks[nextIndex] || null
}

export async function getPreviousSubtask(
  backend: SubtaskBackend,
  projectId: string
): Promise<Subtask | null> {
  const state = await backend.read(projectId)
  if (!state.currentTask?.subtasks) return null
  const prevIndex = (state.currentTask.currentSubtaskIndex || 0) - 1
  if (prevIndex < 0) return null
  return state.currentTask.subtasks[prevIndex] || null
}

export async function getPreviousHandoff(
  backend: SubtaskBackend,
  projectId: string
): Promise<{
  fromSubtask: string
  outputForNextAgent: string
  filesChanged: Array<{ path: string; action: string }>
  whatWasDone: string[]
} | null> {
  const prev = await getPreviousSubtask(backend, projectId)
  if (!prev?.summary?.outputForNextAgent) return null
  return {
    fromSubtask: prev.description,
    outputForNextAgent: prev.summary.outputForNextAgent,
    filesChanged: prev.summary.filesChanged,
    whatWasDone: prev.summary.whatWasDone,
  }
}

export async function getSubtasks(backend: SubtaskBackend, projectId: string): Promise<Subtask[]> {
  const state = await backend.read(projectId)
  return state.currentTask?.subtasks || []
}

export async function getSubtaskProgress(
  backend: SubtaskBackend,
  projectId: string
): Promise<{ completed: number; total: number; percentage: number } | null> {
  const state = await backend.read(projectId)
  return state.currentTask?.subtaskProgress || null
}

export async function hasSubtasks(backend: SubtaskBackend, projectId: string): Promise<boolean> {
  const state = await backend.read(projectId)
  return (state.currentTask?.subtasks?.length || 0) > 0
}

export async function areAllSubtasksComplete(
  backend: SubtaskBackend,
  projectId: string
): Promise<boolean> {
  const state = await backend.read(projectId)
  if (!state.currentTask?.subtasks) return true
  return state.currentTask.subtasks.every(
    (s) => s.status === 'completed' || s.status === 'failed' || s.status === 'skipped'
  )
}

export async function failSubtask(
  backend: SubtaskBackend,
  projectId: string,
  error: string
): Promise<Subtask | null> {
  const state = await backend.read(projectId)
  if (!state.currentTask?.subtasks) return null

  const currentIndex = state.currentTask.currentSubtaskIndex || 0
  const current = state.currentTask.subtasks[currentIndex]
  if (!current) return null

  const updatedSubtasks = [...state.currentTask.subtasks]
  updatedSubtasks[currentIndex] = {
    ...current,
    status: 'failed',
    completedAt: getTimestamp(),
    output: `Failed: ${error}`,
  }

  const nextIndex = currentIndex + 1
  const total = updatedSubtasks.length
  if (nextIndex < total) {
    updatedSubtasks[nextIndex] = {
      ...updatedSubtasks[nextIndex],
      status: 'in_progress',
      startedAt: getTimestamp(),
    }
  }

  const resolved = updatedSubtasks.filter(
    (s) => s.status === 'completed' || s.status === 'failed' || s.status === 'skipped'
  ).length
  const percentage = Math.round((resolved / total) * 100)

  await backend.update(projectId, (s) => ({
    ...s,
    currentTask: {
      ...s.currentTask!,
      subtasks: updatedSubtasks,
      currentSubtaskIndex: nextIndex < total ? nextIndex : currentIndex,
      subtaskProgress: { completed: resolved, total, percentage },
    },
    lastUpdated: getTimestamp(),
  }))

  await backend.publish(projectId, 'subtask.failed', {
    taskId: state.currentTask.id,
    subtaskId: current.id,
    description: current.description,
    error,
  })

  return nextIndex < total ? updatedSubtasks[nextIndex] : null
}

export async function skipSubtask(
  backend: SubtaskBackend,
  projectId: string,
  reason: string
): Promise<Subtask | null> {
  const state = await backend.read(projectId)
  if (!state.currentTask?.subtasks) return null

  const currentIndex = state.currentTask.currentSubtaskIndex || 0
  const current = state.currentTask.subtasks[currentIndex]
  if (!current) return null

  const updatedSubtasks = [...state.currentTask.subtasks]
  updatedSubtasks[currentIndex] = {
    ...current,
    status: 'skipped',
    completedAt: getTimestamp(),
    output: `Skipped: ${reason}`,
    skipReason: reason,
  }

  const nextIndex = currentIndex + 1
  const total = updatedSubtasks.length
  if (nextIndex < total) {
    updatedSubtasks[nextIndex] = {
      ...updatedSubtasks[nextIndex],
      status: 'in_progress',
      startedAt: getTimestamp(),
    }
  }

  const resolved = updatedSubtasks.filter(
    (s) => s.status === 'completed' || s.status === 'failed' || s.status === 'skipped'
  ).length
  const percentage = Math.round((resolved / total) * 100)

  await backend.update(projectId, (s) => ({
    ...s,
    currentTask: {
      ...s.currentTask!,
      subtasks: updatedSubtasks,
      currentSubtaskIndex: nextIndex < total ? nextIndex : currentIndex,
      subtaskProgress: { completed: resolved, total, percentage },
    },
    lastUpdated: getTimestamp(),
  }))

  await backend.publish(projectId, 'subtask.skipped', {
    taskId: state.currentTask.id,
    subtaskId: current.id,
    description: current.description,
    reason,
  })

  return nextIndex < total ? updatedSubtasks[nextIndex] : null
}

export async function blockSubtask(
  backend: SubtaskBackend,
  projectId: string,
  blocker: string
): Promise<Subtask | null> {
  const state = await backend.read(projectId)
  if (!state.currentTask?.subtasks) return null

  const currentIndex = state.currentTask.currentSubtaskIndex || 0
  const current = state.currentTask.subtasks[currentIndex]
  if (!current) return null

  const updatedSubtasks = [...state.currentTask.subtasks]
  updatedSubtasks[currentIndex] = {
    ...current,
    status: 'blocked',
    output: `Blocked: ${blocker}`,
    blockReason: blocker,
  }

  // blocked doesn't halt — advance to next subtask if available
  const nextIndex = currentIndex + 1
  const total = updatedSubtasks.length
  if (nextIndex < total) {
    updatedSubtasks[nextIndex] = {
      ...updatedSubtasks[nextIndex],
      status: 'in_progress',
      startedAt: getTimestamp(),
    }
  }

  await backend.update(projectId, (s) => ({
    ...s,
    currentTask: {
      ...s.currentTask!,
      subtasks: updatedSubtasks,
      currentSubtaskIndex: nextIndex < total ? nextIndex : currentIndex,
    },
    lastUpdated: getTimestamp(),
  }))

  await backend.publish(projectId, 'subtask.blocked', {
    taskId: state.currentTask.id,
    subtaskId: current.id,
    description: current.description,
    blocker,
  })

  return nextIndex < total ? updatedSubtasks[nextIndex] : null
}
