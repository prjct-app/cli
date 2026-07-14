/**
 * Per-sync state writers — `project` doc, state.json, ensure dirs,
 * and the lean memory-event entry. Extracted so SyncService stays
 * orchestration-only.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { StateJson } from '../../schemas/state'
import { prjctDb } from '../../storage/database'
import { stateStorage } from '../../storage/state-storage'
import { describeFsWriteError, getErrorMessage } from '../../types/fs'
import type { GitData, ProjectStats } from '../../types/project-sync'
import type { StackDetection } from '../../types/stack'
import * as dateHelper from '../../utils/date-helper'
import log from '../../utils/logger'
import { localStateGenerator } from '../local-state-generator'

const PROJECT_DIRS = ['storage', 'context', 'memory', 'analysis', 'config', 'sync'] as const

/**
 * Best-effort: ensure the per-project directory tree under
 * `globalPath` exists before any writer touches it.
 */
export async function ensureProjectDirectories(globalPath: string): Promise<void> {
  try {
    await Promise.all(
      PROJECT_DIRS.map((dir) => fs.mkdir(path.join(globalPath, dir), { recursive: true }))
    )
  } catch (error) {
    throw new Error(describeFsWriteError(error, globalPath, 'project directories'))
  }
}

export async function updateProjectDoc(args: {
  projectId: string
  projectPath: string
  cliVersion: string
  git: GitData
  stats: ProjectStats
}): Promise<void> {
  const { projectId, projectPath, cliVersion, git, stats } = args
  const existing: Record<string, unknown> =
    prjctDb.getDoc<Record<string, unknown>>(projectId, 'project') || {}

  const updated = {
    ...existing,
    projectId,
    repoPath: projectPath,
    name: stats.name,
    version: stats.version,
    cliVersion,
    techStack: stats.frameworks,
    fileCount: stats.fileCount,
    commitCount: git.commits,
    stack: stats.ecosystem,
    currentBranch: git.branch,
    hasUncommittedChanges: git.hasChanges,
    createdAt: existing.createdAt || dateHelper.getTimestamp(),
    lastSync: dateHelper.getTimestamp(),
    // Staleness tracking (PRJ-120)
    lastSyncCommit: git.recentCommits[0]?.hash || null,
    lastSyncBranch: git.branch,
  }

  prjctDb.setDoc(projectId, 'project', updated)
}

export async function updateStateDoc(args: {
  projectId: string
  projectPath: string
  stats: ProjectStats
  stack: StackDetection
}): Promise<void> {
  const { projectId, projectPath, stats, stack } = args
  const stateData = await stateStorage.read(projectId)
  const state: Record<string, unknown> = { ...stateData }

  state.projectId = projectId
  state.stack = {
    language: stats.languages[0] || 'Unknown',
    framework: stats.frameworks[0] || null,
  }
  state.domains = {
    hasFrontend: stack.hasFrontend,
    hasBackend: stack.hasBackend,
    hasDatabase: stack.hasDatabase,
    hasTesting: stack.hasTesting,
    hasDocker: stack.hasDocker,
  }
  state.projectType = stats.projectType
  state.metrics = { totalFiles: stats.fileCount }
  state.lastSync = dateHelper.getTimestamp()
  state.lastUpdated = dateHelper.getTimestamp()
  state.context = {
    ...((state.context as Record<string, unknown>) || {}),
    lastSession: dateHelper.getTimestamp(),
    lastAction: 'Synced project',
    nextAction: 'Run `p. work "intent"` to start a work cycle',
  }

  await stateStorage.write(projectId, state as StateJson)

  // Source of truth is SQLite + generated vault. Remove the legacy
  // repo-local state stub if an older install created it; never refresh it.
  try {
    await localStateGenerator.remove(projectPath)
  } catch (error) {
    log.debug('Legacy local state cleanup failed (optional)', { error: getErrorMessage(error) })
  }
}

/**
 * One memory event per sync — gives the timeline a heartbeat.
 */
export function logSyncEvent(projectId: string, git: GitData, stats: ProjectStats): void {
  prjctDb.appendEvent(projectId, 'sync', {
    branch: git.branch,
    uncommitted: git.hasChanges,
    fileCount: stats.fileCount,
    commitCount: git.commits,
  })
}
