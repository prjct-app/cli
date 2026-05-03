/**
 * Empty-state factories used by `SyncService` when an early branch
 * needs to short-circuit before the real data has been gathered.
 *
 * Each function returns a fresh object so callers can mutate without
 * affecting the others. Pure — no I/O, no `this`.
 */

import type { GitData, ProjectCommands, ProjectStats } from '../../types/project-sync'
import type { StackDetection } from '../../types/stack'

export function emptyGitData(): GitData {
  return {
    branch: 'main',
    commits: 0,
    contributors: 0,
    hasChanges: false,
    stagedFiles: [],
    modifiedFiles: [],
    untrackedFiles: [],
    recentCommits: [],
    weeklyCommits: 0,
  }
}

export function emptyStats(): ProjectStats {
  return {
    fileCount: 0,
    version: '0.0.0',
    name: 'unknown',
    ecosystem: 'unknown',
    projectType: 'simple',
    languages: [],
    frameworks: [],
  }
}

export function emptyCommands(): ProjectCommands {
  return {
    install: 'npm install',
    run: 'npm run',
    test: 'npm test',
    build: 'npm run build',
    dev: 'npm run dev',
    lint: 'npm run lint',
    format: 'npm run format',
  }
}

export function emptyStack(): StackDetection {
  return {
    hasFrontend: false,
    hasBackend: false,
    hasDatabase: false,
    hasDocker: false,
    hasTesting: false,
    frontendType: null,
    frameworks: [],
  }
}
