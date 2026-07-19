/**
 * Shared git helper functions for session management.
 *
 * Extracted from session-snapshot.ts to eliminate duplication
 * across session files that need basic git state.
 *
 * Best-effort READ helpers: typed exit and infra both degrade to
 * empty/undefined (labels must never crash ship/session). Value over
 * raw promisify(exec): bounded timeout + no shell + no hang.
 */

import { runGit } from '../utils/exec'

const HELPER_TIMEOUT_MS = 5_000

/**
 * Get current git branch name.
 * Returns undefined if not in a git repo, detached HEAD, or git is unhealthy.
 */
export async function getGitBranch(projectPath: string): Promise<string | undefined> {
  const res = await runGit(['branch', '--show-current'], {
    cwd: projectPath,
    timeoutMs: HELPER_TIMEOUT_MS,
  })
  if (!res.ok) return undefined
  return res.stdout.trim() || undefined
}

/**
 * Get list of modified files (tracked, uncommitted changes).
 * Falls back to unstaged diff if HEAD comparison fails (e.g., empty repo).
 * Bounded + shell-free (no `2>/dev/null ||` pipelines).
 */
export async function getModifiedFiles(projectPath: string, limit = 20): Promise<string[]> {
  const parse = (stdout: string): string[] =>
    stdout
      .trim()
      .split('\n')
      .filter((f) => f.length > 0)
      .slice(0, limit)

  const vsHead = await runGit(['diff', '--name-only', 'HEAD'], {
    cwd: projectPath,
    timeoutMs: HELPER_TIMEOUT_MS,
  })
  if (vsHead.ok) {
    const files = parse(vsHead.stdout)
    if (files.length > 0) return files
  }

  // Fresh repo / no HEAD: unstaged working-tree names only.
  const unstaged = await runGit(['diff', '--name-only'], {
    cwd: projectPath,
    timeoutMs: HELPER_TIMEOUT_MS,
  })
  if (!unstaged.ok) return []
  return parse(unstaged.stdout)
}
