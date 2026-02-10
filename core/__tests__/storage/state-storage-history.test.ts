/**
 * State Storage Task History Tests
 *
 * Tests for task history functionality in StateStorage:
 * - Task history push on completion
 * - FIFO eviction (max 20 entries)
 * - Backward compatibility (undefined taskHistory)
 * - Accessor methods (getTaskHistory, getMostRecentTask, getTaskHistoryByType)
 * - Context injection (markdown generation with filtering)
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import type { CurrentTask, StateJson } from '../../schemas/state'
import { prjctDb } from '../../storage/database'
import { stateStorage } from '../../storage/state-storage'

// =============================================================================
// Test Setup
// =============================================================================

let tmpRoot: string | null = null
let testProjectId: string

// Mock pathManager to use temp directory
const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)
const originalGetStoragePath = pathManager.getStoragePath.bind(pathManager)
const originalGetFilePath = pathManager.getFilePath.bind(pathManager)

beforeEach(async () => {
  // Create temp directory for test isolation
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-history-test-'))
  testProjectId = `test-history-${Date.now()}`

  // Mock pathManager to use temp directory
  pathManager.getGlobalProjectPath = (projectId: string) => {
    return path.join(tmpRoot!, projectId)
  }

  pathManager.getStoragePath = (projectId: string, filename: string) => {
    return path.join(tmpRoot!, projectId, 'storage', filename)
  }

  pathManager.getFilePath = (projectId: string, layer: string, filename: string) => {
    return path.join(tmpRoot!, projectId, layer, filename)
  }

  // Create storage and sync directories
  const storagePath = pathManager.getStoragePath(testProjectId, '')
  await fs.mkdir(storagePath, { recursive: true })

  const syncPath = path.join(tmpRoot!, testProjectId, 'sync')
  await fs.mkdir(syncPath, { recursive: true })
})

afterEach(async () => {
  // Close SQLite connections before cleanup
  prjctDb.close()

  // Restore original pathManager methods
  pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
  pathManager.getStoragePath = originalGetStoragePath
  pathManager.getFilePath = originalGetFilePath

  // Clean up temp directory
  if (tmpRoot) {
    await fs.rm(tmpRoot, { recursive: true, force: true })
    tmpRoot = null
  }
})

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a mock task for testing
 */
function createMockTask(overrides: Partial<CurrentTask> = {}): CurrentTask {
  return {
    id: `task-${Date.now()}`,
    description: 'Test task',
    startedAt: new Date().toISOString(),
    sessionId: `session-${Date.now()}`,
    ...overrides,
  }
}

/**
 * Complete a task and return the state
 */
async function completeTaskAndGetState(projectId: string, task: CurrentTask): Promise<StateJson> {
  // Start the task
  await stateStorage.startTask(projectId, task)

  // Complete the task
  await stateStorage.completeTask(projectId)

  // Return the state
  return await stateStorage.read(projectId)
}

// =============================================================================
// Tests: Task History Push on Completion
// =============================================================================

describe('Task History - Push on Completion', () => {
  it('should add completed task to taskHistory array', async () => {
    const task = createMockTask({
      description: 'Test task 1',
    })

    const state = await completeTaskAndGetState(testProjectId, task)

    expect(state.taskHistory).toBeDefined()
    expect(state.taskHistory?.length).toBe(1)
    expect(state.taskHistory![0].title).toBe('Test task 1')
  })

  it('should include all required metadata in history entry', async () => {
    const task = createMockTask({
      description: 'Test task with metadata',
      linearId: 'PRJ-123',
      linearUuid: 'uuid-123',
    })

    const state = await completeTaskAndGetState(testProjectId, task)

    const entry = state.taskHistory![0]
    expect(entry.taskId).toBe(task.id)
    expect(entry.title).toBe('Test task with metadata')
    expect(entry.startedAt).toBeDefined() // startedAt is set by startTask()
    expect(entry.completedAt).toBeDefined()
    expect(entry.subtaskCount).toBe(0)
    expect(entry.subtaskSummaries).toEqual([])
    expect(entry.outcome).toBe('Task completed')
    expect(entry.linearId).toBe('PRJ-123')
    expect(entry.linearUuid).toBe('uuid-123')
  })

  it('should extract subtask summaries from completed task', async () => {
    const task = createMockTask({
      description: 'Task with subtasks',
      subtasks: [
        {
          id: 'subtask-1',
          description: 'First subtask',
          domain: 'backend',
          agent: 'backend.md',
          status: 'completed',
          dependsOn: [],
          summary: {
            title: 'Subtask 1 Complete',
            description: 'Did some work',
            filesChanged: [{ path: 'file1.ts', action: 'modified' }],
            whatWasDone: ['Made changes'],
            outputForNextAgent: 'Ready for next step',
          },
        },
        {
          id: 'subtask-2',
          description: 'Second subtask',
          domain: 'backend',
          agent: 'backend.md',
          status: 'pending',
          dependsOn: [],
        },
      ],
    })

    const state = await completeTaskAndGetState(testProjectId, task)

    const entry = state.taskHistory![0]
    expect(entry.subtaskCount).toBe(2)
    expect(entry.subtaskSummaries.length).toBe(1) // Only completed with summary
    expect(entry.subtaskSummaries[0].title).toBe('Subtask 1 Complete')
  })

  it('should preserve order - newest entries first', async () => {
    // Complete 3 tasks
    for (let i = 1; i <= 3; i++) {
      const task = createMockTask({
        description: `Task ${i}`,
      })
      await completeTaskAndGetState(testProjectId, task)
    }

    const state = await stateStorage.read(testProjectId)

    expect(state.taskHistory?.length).toBe(3)
    expect(state.taskHistory![0].title).toBe('Task 3') // Newest first
    expect(state.taskHistory![1].title).toBe('Task 2')
    expect(state.taskHistory![2].title).toBe('Task 1') // Oldest last
  })
})

// =============================================================================
// Tests: FIFO Eviction
// =============================================================================

describe('Task History - FIFO Eviction', () => {
  it('should enforce max 20 entries', async () => {
    // Complete 25 tasks
    for (let i = 1; i <= 25; i++) {
      const task = createMockTask({
        description: `Task ${i}`,
      })
      await completeTaskAndGetState(testProjectId, task)
    }

    const state = await stateStorage.read(testProjectId)

    expect(state.taskHistory?.length).toBe(20) // Max 20
  })

  it('should drop oldest entries when exceeding limit', async () => {
    // Complete 22 tasks
    for (let i = 1; i <= 22; i++) {
      const task = createMockTask({
        description: `Task ${i}`,
      })
      await completeTaskAndGetState(testProjectId, task)
    }

    const state = await stateStorage.read(testProjectId)

    expect(state.taskHistory?.length).toBe(20)
    expect(state.taskHistory![0].title).toBe('Task 22') // Newest
    expect(state.taskHistory![19].title).toBe('Task 3') // Oldest kept
    // Task 1 and Task 2 should be dropped
  })
})

// =============================================================================
// Tests: Backward Compatibility
// =============================================================================

describe('Task History - Backward Compatibility', () => {
  it('should initialize taskHistory as empty array when undefined', async () => {
    // Read state before any tasks (should use default)
    const state = await stateStorage.read(testProjectId)

    expect(state.taskHistory).toBeDefined()
    expect(Array.isArray(state.taskHistory)).toBe(true)
    expect(state.taskHistory?.length).toBe(0)
  })

  it('should handle missing taskHistory field in existing state', async () => {
    // Manually write state without taskHistory field
    const stateFile = pathManager.getStoragePath(testProjectId, 'state.json')

    await fs.writeFile(
      stateFile,
      JSON.stringify({
        currentTask: null,
        pausedTasks: [],
        lastUpdated: new Date().toISOString(),
        // No taskHistory field
      })
    )

    // Complete a task - should work without error
    const task = createMockTask({ description: 'New task' })
    const state = await completeTaskAndGetState(testProjectId, task)

    expect(state.taskHistory).toBeDefined()
    expect(state.taskHistory?.length).toBe(1)
  })
})

// =============================================================================
// Tests: Accessor Methods
// =============================================================================

describe('Task History - Accessor Methods', () => {
  beforeEach(async () => {
    // Setup: Complete 3 tasks with different classifications
    const tasks = [
      { description: 'Feature task 1', type: 'feature' },
      { description: 'Bug fix', type: 'bug' },
      { description: 'Feature task 2', type: 'feature' },
    ]

    for (const taskData of tasks) {
      const task = createMockTask(taskData)
      await completeTaskAndGetState(testProjectId, task)
    }
  })

  it('getTaskHistory() should return full history', async () => {
    const history = await stateStorage.getTaskHistory(testProjectId)

    expect(history.length).toBe(3)
    expect(history[0].title).toBe('Feature task 2') // Newest first
  })

  it('getMostRecentTask() should return latest entry', async () => {
    const recent = await stateStorage.getMostRecentTask(testProjectId)

    expect(recent).not.toBeNull()
    expect(recent!.title).toBe('Feature task 2')
  })

  it('getMostRecentTask() should return null when no history', async () => {
    const emptyProjectId = `empty-${Date.now()}`

    // Create storage directory for empty project
    const storagePath = pathManager.getStoragePath(emptyProjectId, '')
    await fs.mkdir(storagePath, { recursive: true })

    const recent = await stateStorage.getMostRecentTask(emptyProjectId)

    expect(recent).toBeNull()
  })

  it('getTaskHistoryByType() should filter by classification', async () => {
    const featureHistory = await stateStorage.getTaskHistoryByType(testProjectId, 'feature')

    expect(featureHistory.length).toBe(2)
    expect(featureHistory.every((h) => h.classification === 'feature')).toBe(true)
  })

  it('getTaskHistoryByType() should return empty array for no matches', async () => {
    const choreHistory = await stateStorage.getTaskHistoryByType(testProjectId, 'chore')

    expect(choreHistory.length).toBe(0)
  })
})

// =============================================================================
// Tests: Context Injection (Markdown Generation)
// =============================================================================

describe('Task History - Context Injection', () => {
  it('should include task history section in markdown when history exists', async () => {
    // Complete a task
    const task = createMockTask({ description: 'Completed task' })
    await completeTaskAndGetState(testProjectId, task)

    // Generate markdown
    const state = await stateStorage.read(testProjectId)
    const markdown = (stateStorage as any).toMarkdown(state)

    expect(markdown).toContain('Recent tasks')
    expect(markdown).toContain('Completed task')
    expect(markdown).toContain('Task history helps identify patterns')
  })

  it('should filter by current task classification when task is active', async () => {
    // Complete several tasks
    const tasks = [
      { description: 'Feature 1', type: 'feature' },
      { description: 'Bug 1', type: 'bug' },
      { description: 'Feature 2', type: 'feature' },
    ]

    for (const taskData of tasks) {
      const task = createMockTask(taskData)
      await completeTaskAndGetState(testProjectId, task)
    }

    // Start a new bug task (should filter history to bugs only)
    const currentTask = createMockTask({ description: 'Current bug', type: 'bug' })
    await stateStorage.startTask(testProjectId, currentTask)

    const state = await stateStorage.read(testProjectId)
    const markdown = (stateStorage as any).toMarkdown(state)

    expect(markdown).toContain('Recent bug tasks')
    expect(markdown).toContain('Bug 1')
    expect(markdown).not.toContain('Feature 1')
  })

  it('should show max 5 recent tasks when no current task', async () => {
    // Complete 7 tasks
    for (let i = 1; i <= 7; i++) {
      const task = createMockTask({ description: `Task ${i}` })
      await completeTaskAndGetState(testProjectId, task)
    }

    const state = await stateStorage.read(testProjectId)
    const markdown = (stateStorage as any).toMarkdown(state)

    expect(markdown).toContain('Recent tasks (5)')
    expect(markdown).toContain('Task 7')
    expect(markdown).toContain('Task 3')
    expect(markdown).not.toContain('Task 2') // Too old
  })

  it('should show max 3 entries of same type when task is active', async () => {
    // Complete 5 feature tasks
    for (let i = 1; i <= 5; i++) {
      const task = createMockTask({ description: `Feature ${i}`, type: 'feature' })
      await completeTaskAndGetState(testProjectId, task)
    }

    // Start a new feature task
    const currentTask = createMockTask({ description: 'Current feature', type: 'feature' })
    await stateStorage.startTask(testProjectId, currentTask)

    const state = await stateStorage.read(testProjectId)
    const markdown = (stateStorage as any).toMarkdown(state)

    expect(markdown).toContain('Recent feature tasks (3)')
    expect(markdown).toContain('Feature 5')
    expect(markdown).toContain('Feature 4')
    expect(markdown).toContain('Feature 3')
    expect(markdown).not.toContain('Feature 2') // Too old (beyond 3)
  })

  it('should not show history section when taskHistory is empty', async () => {
    const state = await stateStorage.read(testProjectId)
    const markdown = (stateStorage as any).toMarkdown(state)

    expect(markdown).not.toContain('Recent tasks')
    expect(markdown).not.toContain('Task history helps identify patterns')
  })

  it('should include completion time and subtask count', async () => {
    const task = createMockTask({
      description: 'Task with details',
      subtasks: [
        {
          id: 'st-1',
          description: 'Subtask 1',
          domain: 'backend',
          agent: 'backend.md',
          status: 'completed',
          dependsOn: [],
        },
        {
          id: 'st-2',
          description: 'Subtask 2',
          domain: 'backend',
          agent: 'backend.md',
          status: 'completed',
          dependsOn: [],
        },
      ],
    })

    await completeTaskAndGetState(testProjectId, task)

    const state = await stateStorage.read(testProjectId)
    const markdown = (stateStorage as any).toMarkdown(state)

    expect(markdown).toContain('2 subtasks')
    expect(markdown).toContain('Completed:')
  })

  it('should include Linear ID when present', async () => {
    const task = createMockTask({
      description: 'Task with Linear',
      linearId: 'PRJ-456',
    })

    await completeTaskAndGetState(testProjectId, task)

    const state = await stateStorage.read(testProjectId)
    const markdown = (stateStorage as any).toMarkdown(state)

    expect(markdown).toContain('Linear: PRJ-456')
  })
})
