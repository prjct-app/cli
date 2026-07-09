/**
 * Delivery-geometry signal — size of the work vs reviewability.
 * Shared by `prjct review-risk` (advisory) and work-start gates (strict packs).
 */

import { execFileAsync } from '../utils/exec'

export type DeliveryTier = 'trivial' | 'normal' | 'large'
export type DeliveryGeometry = 'direct' | 'single' | 'split'

export const TRIVIAL_MAX_FILES = 2
export const TRIVIAL_MAX_LOC = 20
export const NORMAL_MAX_FILES = 10
/** Soft threshold from gentle-ai "Review Workload Forecast" — above = decide geometry. */
export const NORMAL_MAX_LOC = 400

export interface Changeset {
  base: string
  files: number
  loc: number
  dirs: string[]
  /** committed | working-tree */
  source: 'committed' | 'working-tree' | 'none'
}

export function tierOf(cs: Pick<Changeset, 'files' | 'loc'>): DeliveryTier {
  if (cs.files <= TRIVIAL_MAX_FILES && cs.loc <= TRIVIAL_MAX_LOC) return 'trivial'
  if (cs.files <= NORMAL_MAX_FILES && cs.loc <= NORMAL_MAX_LOC) return 'normal'
  return 'large'
}

export function geometryOf(tier: DeliveryTier): DeliveryGeometry {
  if (tier === 'trivial') return 'direct'
  if (tier === 'normal') return 'single'
  return 'split'
}

async function safeGit(projectPath: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd: projectPath })
    return stdout.trim()
  } catch {
    return null
  }
}

function parseShortstat(shortstat: string): { files: number; loc: number } {
  const filesM = shortstat.match(/(\d+) files? changed/)
  const insM = shortstat.match(/(\d+) insertions?/)
  const delM = shortstat.match(/(\d+) deletions?/)
  const files = filesM ? Number.parseInt(filesM[1]!, 10) : 0
  const loc =
    (insM ? Number.parseInt(insM[1]!, 10) : 0) + (delM ? Number.parseInt(delM[1]!, 10) : 0)
  return { files, loc }
}

/** Committed range vs merge-base with default branch (review-risk path). */
export async function computeCommittedChangeset(projectPath: string): Promise<Changeset | null> {
  let defaultRef = ''
  const originHead = await safeGit(projectPath, ['rev-parse', '--abbrev-ref', 'origin/HEAD'])
  if (originHead && originHead !== 'origin/HEAD') {
    defaultRef = originHead
  } else {
    for (const c of ['main', 'master']) {
      if ((await safeGit(projectPath, ['rev-parse', '--verify', '--quiet', c])) !== null) {
        defaultRef = c
        break
      }
    }
  }
  if (!defaultRef) return null

  const base = await safeGit(projectPath, ['merge-base', defaultRef, 'HEAD'])
  if (!base) return null
  const headSha = await safeGit(projectPath, ['rev-parse', 'HEAD'])
  if (!headSha || headSha === base) return null

  const shortstat = await safeGit(projectPath, ['diff', '--shortstat', `${base}..HEAD`])
  if (shortstat === null) return null
  const { files, loc } = parseShortstat(shortstat)
  const names = (await safeGit(projectPath, ['diff', '--name-only', `${base}..HEAD`])) ?? ''
  const dirs = [
    ...new Set(
      names
        .split('\n')
        .filter(Boolean)
        .map((f) => (f.includes('/') ? f.slice(0, f.indexOf('/')) : '.'))
    ),
  ].sort()

  return { base: base.slice(0, 7), files, loc, dirs, source: 'committed' }
}

/** Uncommitted working tree (staged + unstaged) — gate before more implementation. */
export async function computeWorkingTreeChangeset(projectPath: string): Promise<Changeset | null> {
  const shortstat = await safeGit(projectPath, ['diff', '--shortstat', 'HEAD'])
  const cached = await safeGit(projectPath, ['diff', '--shortstat', '--cached'])
  if (shortstat === null && cached === null) return null
  const a = parseShortstat(shortstat ?? '')
  const b = parseShortstat(cached ?? '')
  const files = Math.max(a.files, b.files)
  const loc = a.loc + b.loc
  if (files === 0 && loc === 0) return null
  const names =
    (await safeGit(projectPath, ['diff', '--name-only', 'HEAD'])) ??
    (await safeGit(projectPath, ['diff', '--name-only', '--cached'])) ??
    ''
  const dirs = [
    ...new Set(
      names
        .split('\n')
        .filter(Boolean)
        .map((f) => (f.includes('/') ? f.slice(0, f.indexOf('/')) : '.'))
    ),
  ].sort()
  return { base: 'HEAD', files, loc, dirs, source: 'working-tree' }
}

export function geometryBlockMessage(cs: Changeset, geometry: DeliveryGeometry): string {
  const dirs = cs.dirs.length > 1 ? ` Natural split lines: ${cs.dirs.slice(0, 6).join(', ')}.` : ''
  return (
    `Delivery geometry gate: ${cs.loc} LOC / ${cs.files} files (${cs.source}) → ` +
    `suggested \`${geometry}\`.${dirs} Decide explicitly: ` +
    `\`prjct work "<intent>" --geometry split|single|direct\` ` +
    `or split the tree before continuing. (Relax: \`prjct config\` deliveryGeometry off.)`
  )
}
