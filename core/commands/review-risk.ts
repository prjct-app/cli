/**
 * `prjct review-risk [--md]` — advisory size/delivery-geometry signal.
 * Never gates (use deliveryGeometry strict on work start for hard gates).
 */

import {
  computeCommittedChangeset,
  type DeliveryGeometry,
  type DeliveryTier,
  geometryOf,
  tierOf,
} from '../services/delivery-geometry'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { failHard } from '../utils/md-aware'
import { PrjctCommandsBase } from './base'

export class ReviewRiskCommands extends PrjctCommandsBase {
  async reviewRisk(
    _arg: string | null = null,
    projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const cs = await computeCommittedChangeset(projectPath)
      if (!cs) {
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

function suggestion(geometry: DeliveryGeometry, dirs: string[]): string {
  if (geometry === 'direct') return 'Small + low-risk — fine to land directly or as one tiny PR.'
  if (geometry === 'single') return 'Cohesive — one reviewable PR.'
  const along =
    dirs.length > 1
      ? ` Natural split lines: ${dirs.join(', ')}.`
      : ' Consider splitting by concern even within this area.'
  return `Large — hard to review in one pass. Consider stacked PRs.${along}`
}

function formatText(
  cs: { base: string; files: number; loc: number; dirs: string[] },
  tier: DeliveryTier,
  geometry: DeliveryGeometry
): string {
  return [
    `Review risk: ${tier.toUpperCase()} — ${cs.files} files, ${cs.loc} LOC vs ${cs.base}`,
    `Delivery: ${geometry} — ${suggestion(geometry, cs.dirs)}`,
    '(advisory — you decide; nothing was changed)',
  ].join('\n')
}

function formatMd(
  cs: { base: string; files: number; loc: number; dirs: string[] },
  tier: DeliveryTier,
  geometry: DeliveryGeometry
): string {
  return [
    '## Review risk',
    '',
    `- **Tier**: ${tier}`,
    `- **Changeset**: ${cs.files} files, ${cs.loc} LOC (vs \`${cs.base}\`)`,
    `- **Dirs touched**: ${cs.dirs.join(', ') || '—'}`,
    `- **Suggested delivery**: \`${geometry}\` — ${suggestion(geometry, cs.dirs)}`,
    '',
    '_Advisory only — no gate, nothing changed. Strict packs gate at work start._',
  ].join('\n')
}

export const _internal = { tierOf, geometryOf }
