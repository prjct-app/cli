/**
 * Git anchors for a TaskContext entry — the commit, the author, and the files
 * in play. Stored as tags so later recall (`recallForFile`, `prjct guard`) can
 * answer "who touched this / what changed during that task?" WITHOUT making the
 * agent read all of `git blame`. All best-effort: a non-repo or a missing piece
 * just omits that field.
 */

import { execFileAsync } from '../utils/exec'

export interface GitContext {
  /** Short HEAD sha at capture time. */
  commit?: string
  /** git config user.name — who was working. */
  author?: string
  /** Files in play: working-tree changes ∪ the last commit's files (capped). */
  files?: string[]
}

async function git(cwd: string, args: string[]): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd })
    return stdout.trim() || undefined
  } catch {
    return undefined
  }
}

export async function deriveGitContext(projectPath: string): Promise<GitContext> {
  const [commit, author, working, lastCommit] = await Promise.all([
    git(projectPath, ['rev-parse', '--short', 'HEAD']),
    git(projectPath, ['config', 'user.name']),
    git(projectPath, ['diff', '--name-only', 'HEAD']),
    git(projectPath, ['show', '--name-only', '--pretty=format:', 'HEAD']),
  ])
  const fileSet = new Set<string>()
  for (const block of [working, lastCommit]) {
    if (!block) continue
    for (const f of block
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean))
      fileSet.add(f)
  }
  const files = [...fileSet].slice(0, 12)
  return { commit, author, files: files.length > 0 ? files : undefined }
}
