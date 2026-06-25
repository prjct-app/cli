/**
 * Build the sanitized project-metadata bag the web app shows on /projects.
 *
 * Sourced from the local `project` doc (stack, branch, version, counts…) plus
 * a git-remote lookup for provider/slug/default-branch. Deliberately NEVER
 * includes the absolute repo path or the full remote URL (which can embed
 * credentials) — only non-sensitive, identifying facts. Best-effort: any git
 * failure just omits that field.
 */

import { prjctDb } from '../../storage/database'
import { execFileAsync } from '../../utils/exec'

export interface ProjectMetaPayload {
  provider?: string
  repoSlug?: string
  currentBranch?: string
  defaultBranch?: string
  stack?: string
  techStack?: string[]
  version?: string
  commitCount?: number
  fileCount?: number
  lastCommit?: string
  hasUncommitted?: boolean
  cliVersion?: string
  syncedAt?: string
}

/** github.com → github, gitlab.com → gitlab, … else "other". */
function providerForHost(host: string): string {
  const h = host.toLowerCase()
  if (h.includes('github')) return 'github'
  if (h.includes('gitlab')) return 'gitlab'
  if (h.includes('bitbucket')) return 'bitbucket'
  return 'other'
}

/**
 * Parse `origin` into a provider + `org/repo` slug, dropping any credentials.
 * Handles scp-like (`git@host:org/repo.git`) and URL (`https://host/org/repo`).
 */
export function parseRemote(url: string): { provider?: string; repoSlug?: string } {
  const raw = url.trim()
  if (!raw) return {}

  const scp = raw.match(/^[^/@]+@([^:/]+):(.+?)(?:\.git)?\/?$/)
  if (scp) {
    return { provider: providerForHost(scp[1]), repoSlug: scp[2] }
  }
  try {
    const u = new URL(raw)
    const slug = u.pathname
      .replace(/^\/+/, '')
      .replace(/\.git$/, '')
      .replace(/\/+$/, '')
    if (!u.host || !slug) return {}
    return { provider: providerForHost(u.host), repoSlug: slug }
  } catch {
    return {}
  }
}

async function gitRemoteUrl(cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], { cwd })
    return stdout.trim() || undefined
  } catch {
    return undefined
  }
}

async function gitDefaultBranch(cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'],
      { cwd }
    )
    return stdout.trim().replace(/^origin\//, '') || undefined
  } catch {
    return undefined
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/** Drop undefined keys so the wire payload stays compact. */
function compact(meta: ProjectMetaPayload): ProjectMetaPayload {
  return Object.fromEntries(
    Object.entries(meta).filter(([, v]) => v !== undefined)
  ) as ProjectMetaPayload
}

/**
 * Assemble the sanitized metadata for a project. Reads the local `project` doc
 * (its `repoPath` is used only as the git cwd, never sent) and enriches it with
 * the git remote provider/slug and default branch.
 */
export async function buildProjectMeta(projectId: string): Promise<ProjectMetaPayload> {
  const doc = prjctDb.getDoc<Record<string, unknown>>(projectId, 'project') || {}
  const cwd = str(doc.repoPath)

  const { provider, repoSlug } = cwd ? parseRemote((await gitRemoteUrl(cwd)) || '') : {}
  const defaultBranch = cwd ? await gitDefaultBranch(cwd) : undefined

  const techStack = Array.isArray(doc.techStack)
    ? doc.techStack.filter((x): x is string => typeof x === 'string')
    : undefined

  return compact({
    provider,
    repoSlug,
    currentBranch: str(doc.currentBranch),
    defaultBranch,
    stack: str(doc.stack),
    techStack: techStack && techStack.length > 0 ? techStack : undefined,
    version: str(doc.version),
    commitCount: num(doc.commitCount),
    fileCount: num(doc.fileCount),
    lastCommit: str(doc.lastSyncCommit),
    hasUncommitted:
      typeof doc.hasUncommittedChanges === 'boolean' ? doc.hasUncommittedChanges : undefined,
    cliVersion: str(doc.cliVersion),
    syncedAt: str(doc.lastSync),
  })
}
