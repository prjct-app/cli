/**
 * Terminal + markdown output formatters for `prjct update`.
 *
 * Phase 1+2 are fatal; Phase 3 (daemon restart) is non-blocking — that
 * asymmetry shows up in both icons and overall success calculation.
 */

import chalk from 'chalk'
import type { CommandResult } from '../../types/commands'
import out from '../../utils/output'

export interface PhaseResult {
  success: boolean
  details: string[]
  errors: string[]
}

export interface PhaseResults {
  phase1: PhaseResult
  phase2: PhaseResult
  phase3: PhaseResult
}

export function formatTerminalOutput(results: PhaseResults, dryRun: boolean): CommandResult {
  // Daemon restart is non-fatal: package + cleanup determine overall success
  const allSuccess = results.phase1.success && results.phase2.success
  const allErrors = [...results.phase1.errors, ...results.phase2.errors]

  console.log('')

  const phases = [
    { label: 'Package', result: results.phase1, fatal: true },
    { label: 'Cleanup', result: results.phase2, fatal: true },
    { label: 'Daemon', result: results.phase3, fatal: false },
  ]

  for (const { label, result, fatal } of phases) {
    const icon = result.success ? chalk.green('✓') : fatal ? chalk.red('✗') : chalk.yellow('⚠')
    console.log(`  ${icon} ${chalk.bold(label)}`)
    for (const detail of result.details) {
      console.log(`    ${chalk.dim(detail)}`)
    }
    for (const err of result.errors) {
      console.log(`    ${chalk.yellow('⚠')} ${err}`)
    }
  }

  console.log('')

  if (dryRun) {
    out.done('Dry run complete — no changes made')
  } else if (allSuccess) {
    out.done('System updated')
  } else {
    out.warn(`Updated with ${allErrors.length} error(s)`)
  }

  return {
    success: allSuccess,
    message: dryRun ? 'Dry run complete' : allSuccess ? 'System updated' : 'Updated with errors',
  }
}

export function formatMdOutput(results: PhaseResults, dryRun: boolean): CommandResult {
  const allSuccess = results.phase1.success && results.phase2.success
  const lines: string[] = []

  lines.push(dryRun ? '# Update (Dry Run)' : '# System Update')
  lines.push('')

  const phases = [
    { label: 'Package Update', result: results.phase1, fatal: true },
    { label: 'Global Cleanup', result: results.phase2, fatal: true },
    { label: 'Daemon Restart', result: results.phase3, fatal: false },
  ]

  for (const { label, result, fatal } of phases) {
    const status = result.success ? 'OK' : fatal ? 'FAILED' : 'WARNING'
    lines.push(`## ${label} (${status})`)
    for (const detail of result.details) {
      lines.push(`- ${detail}`)
    }
    for (const err of result.errors) {
      lines.push(`- WARNING: ${err}`)
    }
    lines.push('')
  }

  if (!dryRun) {
    lines.push(
      allSuccess
        ? '**Status:** All phases completed successfully.'
        : '**Status:** Completed with errors.'
    )
  }

  console.log(lines.join('\n'))

  return {
    success: allSuccess,
    message: dryRun ? 'Dry run complete' : allSuccess ? 'System updated' : 'Updated with errors',
  }
}
