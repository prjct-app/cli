/**
 * Wiki vault path resolution.
 *
 * Default vault location is `~/Documents/prjct/<slug>/`, derived from the
 * main worktree directory name so sibling worktrees of the same project
 * share one vault. Users can override via `vaultPath` in the local
 * `.prjct/prjct.config.json` (absolute, tilde, or relative).
 */

import os from 'node:os'
import path from 'node:path'

export async function getWikiPath(
  projectPath: string,
  overrideVaultPath?: string
): Promise<string> {
  if (overrideVaultPath && overrideVaultPath.trim().length > 0) {
    return resolveVaultOverride(projectPath, overrideVaultPath)
  }

  const rootPath = await resolveProjectRootPath(projectPath)

  // Default: ~/Documents/prjct/<slug>/
  const base = path.basename(path.resolve(rootPath)).toLowerCase()
  const slug = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project'
  return path.join(os.homedir(), 'Documents', 'prjct', slug)
}

/**
 * Disambiguation helper: when two repos share the same basename, the slug
 * collides. Mix in a short hash of the projectId to keep each vault isolated.
 *
 *   ~/Documents/prjct/foo/          (first 'foo')
 *   ~/Documents/prjct/foo-bc401c41/ (second 'foo' with hash)
 */
export function getWikiPathWithProjectHash(projectPath: string, projectId: string): string {
  const base = path.basename(path.resolve(projectPath)).toLowerCase()
  const slug = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project'
  const hash = projectId.replace(/-/g, '').slice(0, 8)
  return path.join(os.homedir(), 'Documents', 'prjct', `${slug}-${hash}`)
}

/** Legacy in-repo vault path. Kept only for migration detection. */
export function getLegacyWikiPath(projectPath: string): string {
  return path.join(projectPath, '.prjct', 'wiki')
}

/**
 * Resolve a project path to the main worktree root when applicable.
 * Returns the input unchanged when not inside a git worktree, when git is
 * unavailable, or when the path doesn't exist on disk. Used so all
 * worktrees of a project share one vault.
 */
async function resolveProjectRootPath(projectPath: string): Promise<string> {
  try {
    const { worktreeService } = await import('../../services/worktree-service')
    const info = await worktreeService.detect(projectPath)
    if (!info) return projectPath
    const mainPath = await worktreeService.getMainWorktree(projectPath)
    return mainPath || projectPath
  } catch {
    return projectPath
  }
}

function resolveVaultOverride(projectPath: string, override: string): string {
  let resolved = override.trim()
  if (resolved.startsWith('~/') || resolved === '~') {
    resolved = path.join(os.homedir(), resolved.slice(1))
  }
  if (!path.isAbsolute(resolved)) {
    // relative to project root so users can keep vault in-repo if they want
    resolved = path.resolve(projectPath, resolved)
  }
  return resolved
}
