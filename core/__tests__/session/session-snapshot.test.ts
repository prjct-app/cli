/**
 * Session Snapshot Tests (PRJ-285)
 *
 * Tests for session continuity and cross-project context preservation:
 * - Snapshot capture on pause
 * - Snapshot restore on resume
 * - Cross-project snapshot listing
 * - Auto-cleanup of stale snapshots
 * - Resume hint generation
 * - Continuity context formatting
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import type { SessionSnapshot } from '../../schemas/session-snapshot'
import { sessionSnapshotManager } from '../../session/session-snapshot'
import { prjctDb } from '../../storage/database'

// Test Setup

let tmpRoot: string | null = null

const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)
const originalGlobalProjectsDir = pathManager.globalProjectsDir
const originalListProjects = pathManager.listProjects.bind(pathManager)

describe('SessionSnapshotManager', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-snapshot-test-'))

    pathManager.getGlobalProjectPath = (projectId: string) => {
      return path.join(tmpRoot!, projectId)
    }

    pathManager.globalProjectsDir = tmpRoot!
  })

  afterEach(async () => {
    prjctDb.close()
    pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
    pathManager.globalProjectsDir = originalGlobalProjectsDir
    pathManager.listProjects = originalListProjects

    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
      tmpRoot = null
    }
  })

  // Snapshot Capture

  describe('capture', () => {
    it('captures a snapshot with all fields', async () => {
      const projectId = 'proj-capture-1'
      const projectPath = '/Users/test/my-app'

      const snapshot = await sessionSnapshotManager.capture(projectId, projectPath, {
        taskDescription: 'Add user authentication',
        taskStatus: 'paused',
        sessionId: 'sess-123',
        activeSubtaskIndex: 2,
        subtaskCount: 5,
        linearId: 'PRJ-100',
        startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
      })

      expect(snapshot.sessionId).toBe('sess-123')
      expect(snapshot.projectId).toBe(projectId)
      expect(snapshot.projectPath).toBe(projectPath)
      expect(snapshot.projectName).toBe('my-app')
      expect(snapshot.taskDescription).toBe('Add user authentication')
      expect(snapshot.taskStatus).toBe('paused')
      expect(snapshot.activeSubtaskIndex).toBe(2)
      expect(snapshot.subtaskCount).toBe(5)
      expect(snapshot.linearId).toBe('PRJ-100')
      expect(snapshot.timestamp).toBeTruthy()
      expect(snapshot.resumeHint).toContain('paused')
      expect(snapshot.resumeHint).toContain('subtask 3 of 5')
      expect(snapshot.durationWorkedSec).toBeGreaterThan(0)
    })

    it('captures snapshot without optional fields', async () => {
      const projectId = 'proj-capture-2'

      const snapshot = await sessionSnapshotManager.capture(projectId, '/tmp/test', {
        taskDescription: 'Fix bug',
        taskStatus: 'active',
        sessionId: 'sess-456',
      })

      expect(snapshot.taskDescription).toBe('Fix bug')
      expect(snapshot.taskStatus).toBe('active')
      expect(snapshot.activeSubtaskIndex).toBeUndefined()
      expect(snapshot.subtaskCount).toBeUndefined()
      expect(snapshot.linearId).toBeUndefined()
      expect(snapshot.resumeHint).toContain('in progress')
    })
  })

  // Snapshot Retrieve & Clear

  describe('getSnapshot / clearSnapshot', () => {
    it('retrieves a captured snapshot', async () => {
      const projectId = 'proj-get-1'

      await sessionSnapshotManager.capture(projectId, '/tmp/test', {
        taskDescription: 'Implement dark mode',
        taskStatus: 'paused',
        sessionId: 'sess-789',
      })

      const snapshot = sessionSnapshotManager.getSnapshot(projectId)
      expect(snapshot).not.toBeNull()
      expect(snapshot!.taskDescription).toBe('Implement dark mode')
    })

    it('returns null when no snapshot exists', () => {
      const snapshot = sessionSnapshotManager.getSnapshot('nonexistent-project')
      expect(snapshot).toBeNull()
    })

    it('clears a snapshot', async () => {
      const projectId = 'proj-clear-1'

      await sessionSnapshotManager.capture(projectId, '/tmp/test', {
        taskDescription: 'Some task',
        taskStatus: 'active',
        sessionId: 'sess-abc',
      })

      expect(sessionSnapshotManager.getSnapshot(projectId)).not.toBeNull()

      sessionSnapshotManager.clearSnapshot(projectId)

      expect(sessionSnapshotManager.getSnapshot(projectId)).toBeNull()
    })
  })

  // Cross-Project Listing

  describe('listAllSnapshots', () => {
    it('lists snapshots across multiple projects', async () => {
      // Create snapshots in two projects
      await sessionSnapshotManager.capture('proj-list-1', '/tmp/app1', {
        taskDescription: 'Task A',
        taskStatus: 'paused',
        sessionId: 'sess-1',
      })

      await sessionSnapshotManager.capture('proj-list-2', '/tmp/app2', {
        taskDescription: 'Task B',
        taskStatus: 'active',
        sessionId: 'sess-2',
      })

      // Mock listProjects to return our test projects
      pathManager.listProjects = async () => ['proj-list-1', 'proj-list-2']

      const snapshots = await sessionSnapshotManager.listAllSnapshots()

      expect(snapshots.length).toBe(2)
      // Most recent first
      expect(snapshots[0].taskDescription).toBe('Task B')
      expect(snapshots[1].taskDescription).toBe('Task A')
    })

    it('returns empty array when no snapshots exist', async () => {
      pathManager.listProjects = async () => []

      const snapshots = await sessionSnapshotManager.listAllSnapshots()
      expect(snapshots.length).toBe(0)
    })

    it('skips projects without snapshots', async () => {
      await sessionSnapshotManager.capture('proj-with', '/tmp/with', {
        taskDescription: 'Has snapshot',
        taskStatus: 'paused',
        sessionId: 'sess-x',
      })

      // proj-without has DB but no snapshot
      prjctDb.setDoc('proj-without', 'some-key', { data: true })

      pathManager.listProjects = async () => ['proj-with', 'proj-without']

      const snapshots = await sessionSnapshotManager.listAllSnapshots()
      expect(snapshots.length).toBe(1)
      expect(snapshots[0].taskDescription).toBe('Has snapshot')
    })
  })

  // Cleanup

  describe('cleanup', () => {
    it('removes snapshots older than max age', async () => {
      // Create a snapshot with old timestamp
      const oldSnapshot: SessionSnapshot = {
        sessionId: 'old-sess',
        projectId: 'proj-old',
        projectPath: '/tmp/old',
        taskDescription: 'Old task',
        taskStatus: 'paused',
        timestamp: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), // 35 days ago
        resumeHint: 'Old task',
      }

      prjctDb.setDoc('proj-old', 'session-snapshot', oldSnapshot)

      // Create a recent snapshot
      await sessionSnapshotManager.capture('proj-recent', '/tmp/recent', {
        taskDescription: 'Recent task',
        taskStatus: 'active',
        sessionId: 'recent-sess',
      })

      pathManager.listProjects = async () => ['proj-old', 'proj-recent']

      const cleaned = await sessionSnapshotManager.cleanup(30)

      expect(cleaned).toBe(1)
      expect(sessionSnapshotManager.getSnapshot('proj-old')).toBeNull()
      expect(sessionSnapshotManager.getSnapshot('proj-recent')).not.toBeNull()
    })

    it('returns 0 when nothing to clean', async () => {
      pathManager.listProjects = async () => []
      const cleaned = await sessionSnapshotManager.cleanup()
      expect(cleaned).toBe(0)
    })
  })

  // Resume Hint Generation

  describe('resume hint', () => {
    it('includes subtask progress', async () => {
      const snapshot = await sessionSnapshotManager.capture('proj-hint-1', '/tmp/test', {
        taskDescription: 'Build API',
        taskStatus: 'paused',
        sessionId: 'sess-hint',
        activeSubtaskIndex: 1,
        subtaskCount: 4,
        startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h ago
      })

      expect(snapshot.resumeHint).toContain('subtask 2 of 4')
      expect(snapshot.resumeHint).toContain('paused')
    })

    it('includes duration for active tasks', async () => {
      const snapshot = await sessionSnapshotManager.capture('proj-hint-2', '/tmp/test', {
        taskDescription: 'Refactor code',
        taskStatus: 'active',
        sessionId: 'sess-hint-2',
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
      })

      expect(snapshot.resumeHint).toContain('in progress')
      expect(snapshot.resumeHint).toContain('work')
    })
  })

  // Continuity Context Formatting

  describe('formatContinuityContext', () => {
    it('formats full context for LLM consumption', async () => {
      const snapshot = await sessionSnapshotManager.capture('proj-ctx-1', '/tmp/test', {
        taskDescription: 'Add dark mode',
        taskStatus: 'paused',
        sessionId: 'sess-ctx',
        activeSubtaskIndex: 2,
        subtaskCount: 5,
        startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      })

      const context = sessionSnapshotManager.formatContinuityContext(snapshot)

      expect(context).toContain('Session Continuity')
      expect(context).toContain('Add dark mode')
      expect(context).toContain('paused')
      expect(context).toContain('subtask 3/5')
      expect(context).toContain('Resume hint')
    })

    it('includes branch info when available', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'sess-branch',
        projectId: 'proj-branch',
        projectPath: '/tmp/test',
        taskDescription: 'Feature work',
        taskStatus: 'active',
        branch: 'feat/dark-mode',
        timestamp: new Date().toISOString(),
        resumeHint: 'Task was in progress',
      }

      const context = sessionSnapshotManager.formatContinuityContext(snapshot)
      expect(context).toContain('feat/dark-mode')
    })
  })
})
