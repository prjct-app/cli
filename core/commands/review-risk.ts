/**
 * Review-risk command — `prjct review-risk [--md]`
 *
 * Minimal advisory signal for harnesses #18/19/20 (Review Warlock +
 * Delivery Strategy + Chain Strategy), collapsed into one read.
 *
 * Looks at the committed changeset vs the merge-base with the default
 * branch, derives a size tier, and SUGGESTS a delivery geometry
 * (direct / single / split). It never gates, never splits, never
 * touches git — same read-only/Tier-1 contract as `prjct retro` /
 * `prjct health`. The human/agent decides.
 */

import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { execFileAsync } from '../utils/exec'
import { failHard } from '../utils/md-aware'
import { PrjctCommandsBase } from './base'

type Tier = 'trivial' | 'normal' | 'large'
type Geometry = 'direct' | 'single' | 'split'

// Size thresholds. Deliberately blunt — this is an advisory nudge, not
// a measurement. A wrong tier costs a glance, not a block.
const TRIVIAL_MAX_FILES = 2
const TRIVIAL_MAX_LOC = 20
const NORMAL_MAX_FILES = 10
const NORMAL_MAX_LOC = 400

interface Changeset {
  base: string
  files: number
  loc: number
  dirs: string[]
}

export class ReviewRiskCommands extends PrjctCommandsBase {
  async reviewRisk(
    _arg: string | null = null,
    projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const cs = await computeChangeset(projectPath)
      if (!cs) {
        // No git / no commits / detached / no base — graceful no-signal.
        const msg = 'review-risk: no comparable changeset (no base branch or nothing committed).'
        console.log(options.md ? `## Review risk\n\n_${msg}_\n` : msg)
        return { success: true, tier: 'trivial', files: 0, loc: 0, geometry: geometryOf('trivial') }
      }

      const tier = tierOf(cs)
      const geometry = geometryOf(tier)

      console.log(options.md ? formatMd(cs, tier, geometry) : formatText(cs, tier, geometry))
      return { success: true, tier, files: cs.files, loc: cs.loc, geometry }
    } catch (error) {
      return failHard(getErrorMessage(error))
    }
  }
}

// Changeset computation — committed range vs merge-base with default branch.

async function git(projectPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: projectPath })
  return stdout.trim()
}

async function safeGit(projectPath: string, args: string[]): Promise<string | null> {
  try {
    return await git(projectPath, args)
  } catch {
    return null
  }
}

async function computeChangeset(projectPath: string): Promise<Changeset | null> {
  // Default branch: prefer origin/HEAD's target, then main/master.
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
  if (!headSha || headSha === base) return null // nothing ahead of base

  const shortstat = await safeGit(projectPath, ['diff', '--shortstat', `${base}..HEAD`])
  if (shortstat === null) return null
  // Format: " 3 files changed, 42 insertions(+), 17 deletions(-)"
  const filesM = shortstat.match(/(\d+) files? changed/)
  const insM = shortstat.match(/(\d+) insertions?/)
  const delM = shortstat.match(/(\d+) deletions?/)
  const files = filesM ? Number.parseInt(filesM[1]!, 10) : 0
  const loc =
    (insM ? Number.parseInt(insM[1]!, 10) : 0) + (delM ? Number.parseInt(delM[1]!, 10) : 0)

  const names = (await safeGit(projectPath, ['diff', '--name-only', `${base}..HEAD`])) ?? ''
  const dirs = [
    ...new Set(
      names
        .split('\n')
        .filter(Boolean)
        .map((f) => (f.includes('/') ? f.slice(0, f.indexOf('/')) : '.'))
    ),
  ].sort()

  return { base: base.slice(0, 7), files, loc, dirs }
}

function tierOf(cs: Changeset): Tier {
  if (cs.files <= TRIVIAL_MAX_FILES && cs.loc <= TRIVIAL_MAX_LOC) return 'trivial'
  if (cs.files <= NORMAL_MAX_FILES && cs.loc <= NORMAL_MAX_LOC) return 'normal'
  return 'large'
}

function geometryOf(tier: Tier): Geometry {
  if (tier === 'trivial') return 'direct'
  if (tier === 'normal') return 'single'
  return 'split'
}

// Output

function suggestion(geometry: Geometry, cs: Changeset): string {
  if (geometry === 'direct') return 'Small + low-risk — fine to land directly or as one tiny PR.'
  if (geometry === 'single') return 'Cohesive — one reviewable PR.'
  const along =
    cs.dirs.length > 1
      ? ` Natural split lines: ${cs.dirs.join(', ')}.`
      : ' Consider splitting by concern even within this area.'
  return `Large — hard to review in one pass. Consider stacked PRs.${along}`
}

function formatText(cs: Changeset, tier: Tier, geometry: Geometry): string {
  return [
    `Review risk: ${tier.toUpperCase()} — ${cs.files} files, ${cs.loc} LOC vs ${cs.base}`,
    `Delivery: ${geometry} — ${suggestion(geometry, cs)}`,
    '(advisory — you decide; nothing was changed)',
  ].join('\n')
}

function formatMd(cs: Changeset, tier: Tier, geometry: Geometry): string {
  return [
    '## Review risk',
    '',
    `- **Tier**: ${tier}`,
    `- **Changeset**: ${cs.files} files, ${cs.loc} LOC (vs \`${cs.base}\`)`,
    `- **Dirs touched**: ${cs.dirs.join(', ') || '—'}`,
    `- **Suggested delivery**: \`${geometry}\` — ${suggestion(geometry, cs)}`,
    '',
    '_Advisory only — no gate, nothing changed._',
  ].join('\n')
}

/** Exported for unit tests — pure deterministic core. */
export const _internal = { tierOf, geometryOf }
