/**
 * SessionSnapshotManager (PRJ-285)
 *
 * Captures and restores session snapshots for cross-session continuity.
 * Snapshots are stored in each project's SQLite kv_store with key 'session-snapshot'.
 *
 * Key behaviors:
 * - Captures snapshot on pause and project switch
 * - Restores snapshot on project re-entry (offers resume)
 * - Lists snapshots across all projects
 * - Auto-cleans snapshots older than 30 days
 */

import pathManager from '../infrastructure/path-manager'
import type { SessionSnapshot } from '../schemas/session-snapshot'
import { prjctDb } from '../storage/database'
import { formatDuration, getTimestamp } from '../utils/date-helper'
import { getGitBranch, getModifiedFiles } from './git-helpers'

const SNAPSHOT_KEY = 'session-snapshot'
const MAX_AGE_DAYS = 30

class SessionSnapshotManager {
  /**
   * Capture a snapshot of the current session state.
   * Called on pause, project switch, or explicit save.
   */
  async capture(
    projectId: string,
    projectPath: string,
    options: {
      taskDescription: string
      taskStatus: 'active' | 'paused'
      sessionId: string
      activeSubtaskIndex?: number
      subtaskCount?: number
      linearId?: string
      startedAt?: string
    }
  ): Promise<SessionSnapshot> {
    const branch = await getGitBranch(projectPath)
    const filesModified = await getModifiedFiles(projectPath)
    const durationWorkedSec = options.startedAt
      ? Math.round((Date.now() - new Date(options.startedAt).getTime()) / 1000)
      : undefined

    // Derive project name from path
    const projectName = projectPath.split('/').pop() || projectPath

    const resumeHint = this.generateResumeHint(options, durationWorkedSec)

    const snapshot: SessionSnapshot = {
      sessionId: options.sessionId,
      projectId,
      projectPath,
      projectName,
      taskDescription: options.taskDescription,
      taskStatus: options.taskStatus,
      activeSubtaskIndex: options.activeSubtaskIndex,
      subtaskCount: options.subtaskCount,
      branch,
      linearId: options.linearId,
      filesModified,
      durationWorkedSec,
      timestamp: getTimestamp(),
      resumeHint,
    }

    prjctDb.setDoc(projectId, SNAPSHOT_KEY, snapshot)

    return snapshot
  }

  /**
   * Get the snapshot for a project, if one exists.
   */
  getSnapshot(projectId: string): SessionSnapshot | null {
    try {
      return prjctDb.getDoc<SessionSnapshot>(projectId, SNAPSHOT_KEY)
    } catch {
      return null
    }
  }

  /**
   * Clear the snapshot for a project (after successful resume or task start).
   */
  clearSnapshot(projectId: string): void {
    try {
      prjctDb.deleteDoc(projectId, SNAPSHOT_KEY)
    } catch {
      // Non-critical
    }
  }

  /**
   * List snapshots across all projects.
   * Scans all project databases for session-snapshot documents.
   */
  async listAllSnapshots(): Promise<SessionSnapshot[]> {
    const projectIds = await pathManager.listProjects()
    const snapshots: SessionSnapshot[] = []

    for (const projectId of projectIds) {
      try {
        if (!prjctDb.exists(projectId)) continue
        const snapshot = prjctDb.getDoc<SessionSnapshot>(projectId, SNAPSHOT_KEY)
        if (snapshot) {
          snapshots.push(snapshot)
        }
      } catch {
        // Skip projects with corrupt/inaccessible DBs
      }
    }

    // Sort by timestamp descending (most recent first)
    snapshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return snapshots
  }

  /**
   * Clean up snapshots older than maxAgeDays.
   */
  async cleanup(maxAgeDays: number = MAX_AGE_DAYS): Promise<number> {
    const projectIds = await pathManager.listProjects()
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    let cleaned = 0

    for (const projectId of projectIds) {
      try {
        if (!prjctDb.exists(projectId)) continue
        const snapshot = prjctDb.getDoc<SessionSnapshot>(projectId, SNAPSHOT_KEY)
        if (snapshot && new Date(snapshot.timestamp).getTime() < cutoff) {
          prjctDb.deleteDoc(projectId, SNAPSHOT_KEY)
          cleaned++
        }
      } catch {
        // Skip
      }
    }

    return cleaned
  }

  /**
   * Build session continuity context for LLM injection.
   * Returns a markdown string or null if no relevant snapshot exists.
   */
  formatContinuityContext(snapshot: SessionSnapshot): string {
    const ago = formatDuration(Date.now() - new Date(snapshot.timestamp).getTime())

    const lines: string[] = [
      'Session Continuity',
      `- Last session: ${ago} ago`,
      `- Task: ${snapshot.taskDescription}`,
      `- Status: ${snapshot.taskStatus}`,
    ]

    if (snapshot.subtaskCount && snapshot.activeSubtaskIndex !== undefined) {
      lines.push(`- Progress: subtask ${snapshot.activeSubtaskIndex + 1}/${snapshot.subtaskCount}`)
    }

    if (snapshot.branch) {
      lines.push(`- Branch: ${snapshot.branch}`)
    }

    if (snapshot.filesModified && snapshot.filesModified.length > 0) {
      const filesList = snapshot.filesModified.slice(0, 5).join(', ')
      const more =
        snapshot.filesModified.length > 5 ? ` (+${snapshot.filesModified.length - 5} more)` : ''
      lines.push(`- Modified files: ${filesList}${more}`)
    }

    if (snapshot.durationWorkedSec) {
      lines.push(`- Time worked: ${formatDuration(snapshot.durationWorkedSec * 1000)}`)
    }

    lines.push(`- Resume hint: ${snapshot.resumeHint}`)

    return lines.join('\n')
  }

  /**
   * Generate a brief, LLM-friendly resume hint.
   */
  private generateResumeHint(
    options: {
      taskDescription: string
      taskStatus: 'active' | 'paused'
      activeSubtaskIndex?: number
      subtaskCount?: number
    },
    durationWorkedSec?: number
  ): string {
    const parts: string[] = []

    if (options.taskStatus === 'paused') {
      parts.push('Task was paused')
    } else {
      parts.push('Task was in progress')
    }

    if (options.subtaskCount && options.activeSubtaskIndex !== undefined) {
      parts.push(`on subtask ${options.activeSubtaskIndex + 1} of ${options.subtaskCount}`)
    }

    if (durationWorkedSec && durationWorkedSec > 60) {
      parts.push(`after ${formatDuration(durationWorkedSec * 1000)} of work`)
    }

    return parts.join(' ')
  }
}

export const sessionSnapshotManager = new SessionSnapshotManager()
export default sessionSnapshotManager
