/**
 * Session-close land cue — inject a short checklist when a cycle is open.
 * Used by SessionStart (advisory) and Stop (strict packs).
 */

import type { LocalConfig } from '../types/config'
import { collectActiveTasks } from './task-overview'

export type LandMode = 'off' | 'advisory' | 'strict'

export function effectiveLandMode(config: LocalConfig | null | undefined): LandMode {
  return config?.land?.mode ?? 'advisory'
}

/**
 * One short block for hooks. Returns null when land is off or nothing to do.
 */
export async function buildLandCue(
  projectId: string,
  projectPath: string,
  config: LocalConfig | null | undefined
): Promise<string | null> {
  const mode = effectiveLandMode(config)
  if (mode === 'off') return null

  const overview = await collectActiveTasks(projectId, projectPath).catch(() => null)
  if (!overview?.current) return null

  const title = overview.current.description.slice(0, 60)
  const hard = mode === 'strict'
  const head = hard ? `# prjct: LAND REQUIRED before context dies` : `# prjct: land the plane`
  return [
    head,
    `Open cycle: "${title}${overview.current.description.length > 60 ? '…' : ''}"`,
    hard
      ? 'Before ending the session: `prjct status done` or `prjct log "…"` + `prjct remember context "Session close: …"`. Then `prjct land`.'
      : 'Before ending the session: `prjct land` · hand-off `prjct remember context "Session close: …"` · optional `prjct memory export` for the team.',
  ].join('\n')
}
