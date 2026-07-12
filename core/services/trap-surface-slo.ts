/**
 * Trap-before-edit SLO — Dynasty D3 / B3.
 *
 * When a file has linked preventive traps (gotcha / anti-pattern / decision),
 * pre-edit MUST surface them. Release gate measures pure coverage: every trap
 * id present in the injected message.
 *
 * Structural (no DB flakiness): tests feed ids + message body.
 */

/** Absolute floor — missing a known trap is a harness regression. */
export const TRAP_SURFACE_MIN_RATE = 1

export interface TrapSurfaceReport {
  trapsPresent: number
  trapsSurfaced: number
  missedIds: string[]
  rate: number
  ok: boolean
  line: string
}

/**
 * Pure: which trap memory ids appear in the pre-edit inject text.
 */
export function countSurfacedTrapIds(
  message: string | null | undefined,
  trapIds: readonly string[]
): { surfaced: string[]; missed: string[] } {
  if (!message || trapIds.length === 0) {
    return {
      surfaced: [],
      missed: trapIds.length === 0 ? [] : [...trapIds],
    }
  }
  const surfaced: string[] = []
  const missed: string[] = []
  for (const id of trapIds) {
    if (id && message.includes(id)) surfaced.push(id)
    else if (id) missed.push(id)
  }
  return { surfaced, missed }
}

/**
 * SLO check: when trapsPresent > 0, rate must be ≥ TRAP_SURFACE_MIN_RATE.
 * Zero traps → ok (nothing to surface).
 */
export function trapSurfaceSlo(input: {
  trapIds: readonly string[]
  message: string | null | undefined
}): TrapSurfaceReport {
  const trapsPresent = input.trapIds.filter(Boolean).length
  if (trapsPresent === 0) {
    return {
      trapsPresent: 0,
      trapsSurfaced: 0,
      missedIds: [],
      rate: 1,
      ok: true,
      line: 'Trap surface: n/a (no traps on file)',
    }
  }
  const { surfaced, missed } = countSurfacedTrapIds(input.message, input.trapIds)
  const rate = surfaced.length / trapsPresent
  const ok = rate >= TRAP_SURFACE_MIN_RATE && missed.length === 0
  return {
    trapsPresent,
    trapsSurfaced: surfaced.length,
    missedIds: missed,
    rate,
    ok,
    line: ok
      ? `Trap surface: ${surfaced.length}/${trapsPresent} (100%)`
      : `Trap surface MISS: ${surfaced.length}/${trapsPresent} missed=${missed.join(',')}`,
  }
}

/**
 * Build a heads-up that is guaranteed to include every trap id (SLO-safe).
 * Callers pass already-recalled preventive entries.
 */
export function formatTrapSurfaceMessage(
  fileBase: string,
  traps: ReadonlyArray<{ id: string; type: string; title: string }>
): string | null {
  if (traps.length === 0) return null
  const lines = [
    `# prjct: heads-up before editing \`${fileBase}\``,
    '',
    `${traps.length} preventive trap(s) recorded against this file:`,
    '',
  ]
  for (const t of traps) {
    lines.push(`- **[${t.type}]** ${t.title}  \`${t.id}\``)
  }
  lines.push('')
  lines.push(
    '> Dynasty trap-before-edit: surface is mandatory. Apply if it still holds; supersede if not.'
  )
  return lines.join('\n')
}
