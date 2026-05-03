/**
 * Workspace-aware (multi-agent parallel) task helpers + token-usage
 * accumulator. Extracted from StateStorage to keep that facade small.
 *
 * Helpers take a `Backend` exposing the public `read`/`update` API
 * plus a typed `publish` proxy and the two task-history helpers that
 * still live on the StateStorage instance.
 */

import type { StateJson, TaskFeedback, TaskHistoryEntry, WorkspaceTask } from '../../schemas/state'
import { getTimestamp } from '../../utils/date-helper'

export interface WorkspaceBackend {
  read(projectId: string): Promise<StateJson>
  update(projectId: string, fn: (s: StateJson) => StateJson): Promise<StateJson>
  publish(projectId: string, type: string, data: Record<string, unknown>): Promise<void>
  createTaskHistoryEntry(
    task: WorkspaceTask,
    completedAt: string,
    feedback?: TaskFeedback
  ): TaskHistoryEntry
  getTaskHistoryFromState(state: StateJson): TaskHistoryEntry[]
  maxTaskHistory: number
}

export async function startTaskInWorkspace(
  backend: WorkspaceBackend,
  projectId: string,
  task: Omit<WorkspaceTask, 'startedAt'>,
  workspaceId: string
): Promise<WorkspaceTask> {
  const workspaceTask: WorkspaceTask = {
    ...task,
    workspaceId,
    startedAt: getTimestamp(),
  }

  await backend.update(projectId, (state) => ({
    ...state,
    activeTasks: [...(state.activeTasks || []), workspaceTask],
    lastUpdated: getTimestamp(),
  }))

  await backend.publish(projectId, 'task.started', {
    taskId: workspaceTask.id,
    description: workspaceTask.description,
    startedAt: workspaceTask.startedAt,
    sessionId: workspaceTask.sessionId,
    workspaceId,
  })

  return workspaceTask
}

export async function getCurrentTaskForWorkspace(
  backend: WorkspaceBackend,
  projectId: string,
  workspaceId: string
): Promise<WorkspaceTask | null> {
  const state = await backend.read(projectId)
  return (state.activeTasks || []).find((t) => t.workspaceId === workspaceId) ?? null
}

export async function completeTaskInWorkspace(
  backend: WorkspaceBackend,
  projectId: string,
  workspaceId: string,
  feedback?: TaskFeedback
): Promise<WorkspaceTask | null> {
  const state = await backend.read(projectId)
  const activeTasks = state.activeTasks || []
  const task = activeTasks.find((t) => t.workspaceId === workspaceId)
  if (!task) return null

  const completedAt = getTimestamp()
  const historyEntry = backend.createTaskHistoryEntry(task, completedAt, feedback)
  const existingHistory = backend.getTaskHistoryFromState(state)
  const taskHistory = [historyEntry, ...existingHistory].slice(0, backend.maxTaskHistory)

  await backend.update(projectId, (s) => ({
    ...s,
    activeTasks: (s.activeTasks || []).filter((t) => t.workspaceId !== workspaceId),
    taskHistory,
    lastUpdated: completedAt,
  }))

  await backend.publish(projectId, 'task.completed', {
    taskId: task.id,
    description: task.description,
    startedAt: task.startedAt,
    completedAt,
    workspaceId,
  })

  return task
}

export async function getActiveTasks(
  backend: WorkspaceBackend,
  projectId: string
): Promise<WorkspaceTask[]> {
  const state = await backend.read(projectId)
  return state.activeTasks || []
}

export async function getActiveTaskCount(
  backend: WorkspaceBackend,
  projectId: string
): Promise<number> {
  const state = await backend.read(projectId)
  return (state.activeTasks || []).length
}

export async function updateWorkspaceTask(
  backend: WorkspaceBackend,
  projectId: string,
  workspaceId: string,
  fields: Partial<WorkspaceTask>
): Promise<WorkspaceTask | null> {
  const state = await backend.read(projectId)
  const activeTasks = state.activeTasks || []
  const index = activeTasks.findIndex((t) => t.workspaceId === workspaceId)
  if (index === -1) return null

  const updated: WorkspaceTask = { ...activeTasks[index], ...fields, workspaceId }

  await backend.update(projectId, (s) => {
    const tasks = [...(s.activeTasks || [])]
    tasks[index] = updated
    return { ...s, activeTasks: tasks, lastUpdated: getTimestamp() }
  })

  return updated
}

export async function addTokens(
  backend: WorkspaceBackend,
  projectId: string,
  tokensIn: number,
  tokensOut: number
): Promise<{ tokensIn: number; tokensOut: number } | null> {
  const state = await backend.read(projectId)
  if (!state.currentTask) return null

  const newIn = (state.currentTask.tokensIn || 0) + tokensIn
  const newOut = (state.currentTask.tokensOut || 0) + tokensOut

  await backend.update(projectId, (s) => ({
    ...s,
    currentTask: {
      ...s.currentTask!,
      tokensIn: newIn,
      tokensOut: newOut,
    },
    lastUpdated: getTimestamp(),
  }))

  return { tokensIn: newIn, tokensOut: newOut }
}
