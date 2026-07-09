/**
 * Session-close land cue — inject a short checklist when a cycle is open.
 * Used by SessionStart (advisory) and Stop (strict packs).
 * Also surfaces context-pressure when the cycle is filling (GSD utilization guard).
 */

import type { LocalConfig } from '../types/config'
import { contextPressureVerdict } from './context-pressure'
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
  // ActiveTaskView may omit turn counters — pressure falls back to ok.
  const pressure = contextPressureVerdict(config, {
    description: overview.current.description,
  })
  // Context critical upgrades advisory land to a hard cue for this session.
  const hard = mode === 'strict' || pressure.level === 'critical'
  const head = hard ? `# prjct: LAND REQUIRED before context dies` : `# prjct: land the plane`
  const lines = [
    head,
    `Open cycle: "${title}${overview.current.description.length > 60 ? '…' : ''}"`,
    hard
      ? 'Before ending the session: `prjct status done` or `prjct log "…"`, then `prjct land` (auto-synthesizes the Session close hand-off — no manual remember).'
      : 'Before ending the session: `prjct land` (auto hand-off) · optional `prjct memory export` for the team.',
  ]
  if (pressure.cue) lines.push('', pressure.cue)
  return lines.join('\n')
}
