/**
 * `prjct harness` — scorecard + Body creation.
 *
 *   score · learn-from · list · use <rig>
 *
 * prjct describes; the host runs LLM work and persists via prjct verbs.
 */

import { existsSync } from 'node:fs'
import path from 'node:path'
import configManager from '../infrastructure/config-manager'
import { probeHarnessCoverage, renderHarnessCoverageMd } from '../services/harness-coverage'
import {
  buildInductionDispatch,
  findRig,
  RIGS,
  renderRigAdoption,
  renderRigList,
} from '../services/harness-rigs'
import { computeHarnessScore, renderHarnessScoreMd } from '../services/harness-score'
import { stateStorage } from '../storage/state-storage'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { PrjctCommandsBase } from './base'

export class HarnessCommands extends PrjctCommandsBase {
  async score(projectPath: string = process.cwd(), options: MdOption = {}): Promise<CommandResult> {
    try {
      // Structural grade is machine-independent (CI/release). Live organic board
      // is advisory: laptop install state must not tank programDone. Adapter
      // presence is gated by weak-model-bench, not ~/.claude probes on runners.
      const coverage = await probeHarnessCoverage(projectPath)
      const report = computeHarnessScore()
      if (options.md) {
        console.log(renderHarnessScoreMd(report, { coverageMd: renderHarnessCoverageMd(coverage) }))
      } else {
        console.log(`Harness grade: ${report.grade}/5${report.programDone ? ' (done)' : ''}`)
        console.log(report.summary)
        for (const c of report.criteria) {
          const mark = c.status === 'green' ? '✓' : c.status === 'amber' ? '△' : '✗'
          console.log(`  ${mark} ${c.name}: ${c.score} — ${c.measured}`)
        }
        console.log(
          `Organic board: ${coverage.liveCount}/${coverage.detectedCount} live (${coverage.organicPct}%) — advisory`
        )
      }
      return {
        success: true,
        grade: report.grade,
        programDone: report.programDone,
        criteria: report.criteria,
        organicPct: coverage.organicPct,
        liveRuntimes: coverage.liveCount,
      }
    } catch (error) {
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /** `prjct harness learn-from` — induction from the just-performed flow. */
  async learnFrom(
    projectPath: string = process.cwd(),
    _options: MdOption = {}
  ): Promise<CommandResult> {
    try {
      let activeCycle: string | null = null
      try {
        const projectId = await configManager.getProjectId(projectPath)
        if (projectId) {
          const task = await stateStorage.getCurrentTask(projectId)
          activeCycle = task?.description ?? null
        }
      } catch {
        // best-effort — induction still works pointing at git + prjct verbs
      }
      const hasGit = existsSync(path.join(projectPath, '.git'))
      console.log(buildInductionDispatch({ activeCycle, hasGit }))
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /** `prjct harness list` — the stealable rigs. */
  async list(_options: MdOption = {}): Promise<CommandResult> {
    console.log(renderRigList())
    return { success: true }
  }

  /** `prjct harness use <name>` — adopt a rig as the Body's base. */
  async use(
    name: string | null,
    _projectPath: string = process.cwd(),
    _options: MdOption = {}
  ): Promise<CommandResult> {
    if (!name) {
      console.error(
        `Usage: prjct harness use <rig>. Available: ${RIGS.map((r) => r.name).join(', ')}.`
      )
      return { success: false, error: 'missing rig name' }
    }
    const rig = findRig(name)
    if (!rig) {
      console.error(`Unknown rig: ${name}. Available: ${RIGS.map((r) => r.name).join(', ')}.`)
      return { success: false, error: `unknown rig: ${name}` }
    }
    console.log(renderRigAdoption(rig))
    return { success: true }
  }
}
