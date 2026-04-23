/**
 * Shipping Commands: ship and related helpers
 * Write-Through Architecture: JSON → MD → Event
 */

import configManager from '../infrastructure/config-manager'
import { ChangelogService } from '../services/changelog-service'
import { syncService } from '../services/sync-service'
import { VersionService } from '../services/version-service'
import { shippedStorage } from '../storage/shipped-storage'
import { stateStorage } from '../storage/state-storage'
import type { CommandResult } from '../types/commands'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import * as dateHelper from '../utils/date-helper'
import { execFileAsync } from '../utils/exec'
import { mdDone, mdList, mdNextSteps, mdOutput, mdSection } from '../utils/md-formatter'
import { getNextSteps, showNextSteps } from '../utils/next-steps'
import out from '../utils/output'
import { executeWorkflowRules } from '../workflow/workflow-engine'
import { PrjctCommandsBase } from './base'

export class ShippingCommands extends PrjctCommandsBase {
  /**
   * /p:ship - Ship feature with complete automated workflow
   */
  async ship(
    feature: string | null,
    projectPath: string = process.cwd(),
    options: { skipHooks?: boolean; md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      let featureName = feature

      // Complete current task implicitly before shipping
      const currentTask = await stateStorage.getCurrentTask(projectId)
      if (currentTask) {
        if (!featureName) featureName = currentTask.description || 'current work'
        await stateStorage.completeTask(projectId)
      }

      if (!featureName) featureName = 'current work'

      // Execute before_ship workflow (gates + steps from DB)
      const beforeResult = await executeWorkflowRules(projectId, 'ship', 'before', {
        projectPath,
        skipRules: options.skipHooks,
      })
      if (!beforeResult.success) {
        const msg =
          beforeResult.gatesFailed.length > 0
            ? `Blocked: ${beforeResult.gatesFailed.join(', ')}`
            : `Step failed: ${beforeResult.gatesFailed.join(', ')}`
        return { success: false, error: msg }
      }

      // SHIP CORE (universal, stack-aware)
      if (!options.md) out.step(1, 4, 'Bumping version...')
      const versionService = new VersionService(projectPath)
      const newVersion = await versionService.bump()

      if (!options.md) out.step(2, 4, 'Updating changelog...')
      const changelogService = new ChangelogService(projectPath)
      await changelogService.addFeature(newVersion, featureName)

      if (!options.md) out.step(3, 4, 'Committing...')
      const commitResult = await this._createShipCommit(featureName, projectPath)

      let pushStatus = 'skipped'
      if (commitResult.success) {
        const pushResult = await this._gitPush(projectPath)
        pushStatus = pushResult.success ? 'pushed' : pushResult.message
      }

      // Write-through: Record shipped feature (JSON → MD → Event)
      await shippedStorage.addShipped(projectId, {
        name: featureName,
        version: newVersion,
      })

      await this.logToMemory(projectPath, 'feature_shipped', {
        feature: featureName,
        version: newVersion,
        timestamp: dateHelper.getTimestamp(),
      })

      // Ship is already recorded in `shipped_features` by
      // shippedStorage.addShipped above, which is what project-memory
      // reads as `type=shipped`. The old `learnDecision` /
      // `recordWorkflow` calls wrote into the pre-v2 memory-system
      // (deleted in Phase C) — redundant with shipped_features.

      // Run after_ship rules
      const afterResult = await executeWorkflowRules(projectId, 'ship', 'after', {
        projectPath,
        skipRules: options.skipHooks,
      })

      // Collect instructions from both phases
      const allInstructions = [...beforeResult.instructions, ...afterResult.instructions]

      // Auto-sync AI context after shipping to ensure agents have latest state
      try {
        if (!options.md) {
          out.step(4, 4, 'Updating AI context...')
        }

        await syncService.sync(projectPath)

        if (!options.md) {
          out.done('✓ AI context updated')
        }
      } catch (syncError) {
        // Log but don't fail the ship — context sync is nice-to-have
        console.warn('⚠️  Failed to sync AI context after shipping:', getErrorMessage(syncError))
      }

      // Regenerate the agent-crawlable wiki so subagents can read the latest
      // ship + memory snapshot with plain Read/Glob. Incremental + deferred
      // under daemon so the ship response isn't held up.
      try {
        const { regenerateWikiDeferred } = await import('../services/wiki-generator')
        await regenerateWikiDeferred(projectPath, projectId)
      } catch (wikiError) {
        console.warn('⚠️  Wiki regeneration failed (non-blocking):', getErrorMessage(wikiError))
      }

      if (options.md) {
        const steps = getNextSteps('ship', true)
        const md = mdOutput(
          mdDone(`Shipped: ${featureName}`, `Version: ${newVersion}`),
          mdSection(
            'Results',
            mdList([
              `Version: ${newVersion}`,
              `Commit: ${commitResult.success ? 'created' : commitResult.message}`,
              `Push: ${pushStatus}`,
              `Workflow steps: ${beforeResult.stepsRun.length > 0 ? beforeResult.stepsRun.join(', ') : 'none'}`,
            ])
          ),
          allInstructions.length > 0
            ? mdSection('Agent Instructions', mdList(allInstructions))
            : null,
          mdNextSteps(steps.map((s) => ({ label: s.desc, command: s.cmd })))
        )
        console.log(md)
      } else {
        out.done(`v${newVersion} shipped`)
        showNextSteps('ship')
      }

      return { success: true, feature: featureName, version: newVersion }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Create git commit for ship
   */
  async _createShipCommit(
    feature: string,
    projectPath: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await execFileAsync('git', ['add', '.'], { cwd: projectPath })

      const commitMsg = `feat: ${feature}\n\nGenerated with [p/](https://www.prjct.app/)`

      await execFileAsync('git', ['commit', '-m', commitMsg], { cwd: projectPath })

      return { success: true, message: 'Committed' }
    } catch (error) {
      if (isNotFoundError(error)) {
        return { success: false, message: 'Git not found' }
      }
      return { success: false, message: `Commit failed: ${getErrorMessage(error)}` }
    }
  }

  /**
   * Push to remote
   */
  async _gitPush(projectPath: string): Promise<{ success: boolean; message: string }> {
    try {
      await execFileAsync('git', ['push'], { cwd: projectPath })
      return { success: true, message: 'Pushed to remote' }
    } catch (error) {
      if (isNotFoundError(error)) {
        return { success: false, message: 'Git not found' }
      }
      return { success: false, message: `Push failed: ${getErrorMessage(error)}` }
    }
  }
}
