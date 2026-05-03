/**
 * Markdown rendering helpers for `prjct workflow --md`.
 *
 * Currently exposes the ASCII flow diagram used by `_workflowShow`.
 * The previous file-level `_buildEfficiencySection`, `_buildRpiSection`,
 * `_loadRepoAnalysis`, `_getFilesModifiedSinceTaskStart`,
 * `_formatMinutesToDuration`, and `_formatVariance` were dead code (no
 * callers in the workflow module) — knip's `ignoreExportsUsedInFile`
 * masked them. Removed in this refactor.
 */

import type { WorkflowRule } from '../../types/storage/extended'

/**
 * Build an ASCII flow diagram for a single command's workflow rules.
 * Shows: gates (before) → hooks (before) → COMMAND → steps → hooks (after).
 */
export function buildFlowDiagram(command: string, rules: WorkflowRule[]): string {
  const gates = rules.filter((r) => r.type === 'gate' && r.position === 'before')
  const instructionsBefore = rules.filter(
    (r) => r.type === 'instruction' && r.position === 'before'
  )
  const hooksBefore = rules.filter((r) => r.type === 'hook' && r.position === 'before')
  const stepsBefore = rules.filter((r) => r.type === 'step' && r.position === 'before')
  const instructionsAfter = rules.filter((r) => r.type === 'instruction' && r.position === 'after')
  const hooksAfter = rules.filter((r) => r.type === 'hook' && r.position === 'after')
  const stepsAfter = rules.filter((r) => r.type === 'step' && r.position === 'after')

  const lines: string[] = []

  const drawBox = (label: string, items: WorkflowRule[], icon: string) => {
    const content = items.map((r) => {
      const status = r.enabled ? icon : 'o'
      return `  ${status} #${r.id} ${r.action}`
    })
    const allLines = [label, ...content]
    const maxLen = Math.max(...allLines.map((l) => l.length))
    const width = maxLen + 2

    lines.push(`+${'-'.repeat(width)}+`)
    for (const line of allLines) {
      lines.push(`| ${line.padEnd(width - 1)}|`)
    }
    lines.push(`+${'-'.repeat(width)}+`)
  }

  const arrow = (target: string[]) => {
    target.push('        |')
    target.push('        v')
  }

  if (gates.length > 0) {
    drawBox('GATES (must pass)', gates, '#')
    arrow(lines)
  }

  if (instructionsBefore.length > 0) {
    drawBox('INSTRUCTIONS (before)', instructionsBefore, '📋')
    arrow(lines)
  }

  if (hooksBefore.length > 0) {
    drawBox('HOOKS (before)', hooksBefore, '>')
    arrow(lines)
  }

  if (stepsBefore.length > 0) {
    drawBox('STEPS (before)', stepsBefore, '>')
    arrow(lines)
  }

  // Command node
  lines.push(`   [ ${command.toUpperCase()} ]`)

  if (instructionsAfter.length > 0) {
    arrow(lines)
    drawBox('INSTRUCTIONS (after)', instructionsAfter, '📋')
  }

  if (hooksAfter.length > 0) {
    arrow(lines)
    drawBox('HOOKS (after)', hooksAfter, '>')
  }

  if (stepsAfter.length > 0) {
    arrow(lines)
    drawBox('STEPS (after)', stepsAfter, '>')
  }

  return lines.join('\n')
}
