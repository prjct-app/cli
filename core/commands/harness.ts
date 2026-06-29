/**
 * `prjct harness` — the two ways to create the Body (Phase C).
 *
 *   prjct harness learn-from   INDUCTION: synthesize repeatable organs from a
 *                              flow you just did by hand.
 *   prjct harness list         list the rigs you can steal as a base.
 *   prjct harness use <name>   STEAL-A-RIG: adopt a rig's organs into prjct.
 *
 * Anti-harness contract: prjct DESCRIBES (emits the dispatch + names the verbs);
 * the host runs the LLM work and persists the organs through prjct verbs.
 */

import { existsSync } from 'node:fs'
import path from 'node:path'
import configManager from '../infrastructure/config-manager'
import {
  buildInductionDispatch,
  findRig,
  RIGS,
  renderRigAdoption,
  renderRigList,
} from '../services/harness-rigs'
import { stateStorage } from '../storage/state-storage'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { PrjctCommandsBase } from './base'

export class HarnessCommands extends PrjctCommandsBase {
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
