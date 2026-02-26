/**
 * Shared git helper functions for session management.
 *
 * Extracted from session-snapshot.ts to eliminate duplication
 * across session files that need basic git state.
 */

import { execAsync } from '../utils/exec'

/**
 * Get current git branch name.
 * Returns undefined if not in a git repo or on a detached HEAD.
 */
export async function getGitBranch(projectPath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync('git branch --show-current', {
      cwd: projectPath,
    })
    return stdout.trim() || undefined
  } catch {
    return undefined
  }
}

/**
 * Get list of modified files (tracked, uncommitted changes).
 * Falls back to unstaged diff if HEAD comparison fails (e.g., empty repo).
 */
export async function getModifiedFiles(projectPath: string, limit = 20): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      'git diff --name-only HEAD 2>/dev/null || git diff --name-only 2>/dev/null',
      { cwd: projectPath }
    )
    return stdout
      .trim()
      .split('\n')
      .filter((f) => f.length > 0)
      .slice(0, limit)
  } catch {
    return []
  }
}
