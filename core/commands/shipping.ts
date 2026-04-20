/**
 * Shipping Commands: ship and related helpers
 * Write-Through Architecture: JSON → MD → Event
 */

import memorySystem from '../agentic/memory-system'
import configManager from '../infrastructure/config-manager'
import { ChangelogService } from '../services/changelog-service'
import { syncService } from '../services/sync-service'
import { VersionService } from '../services/version-service'
import { shippedStorage } from '../storage/shipped-storage'
import { stateStorage } from '../storage/state-storage'
import type { CommandResult } from '../types/commands'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import * as dateHelper from '../utils/date-helper'
import { execAsync, execFileAsync } from '../utils/exec'
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

      await memorySystem.learnDecision(projectId, 'commit_footer', 'prjct', 'ship')

      // Record ship workflow
      await memorySystem.recordWorkflow(projectId, 'ship_completed', {
        description: 'Ship with workflow rules',
        feature: featureName,
        version: newVersion,
      })

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
      // ship + memory snapshot with plain Read/Glob — no CLI round-trip.
      try {
        const { generateWiki } = await import('../services/wiki-generator')
        await generateWiki(projectPath, projectId)
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
    _projectPath: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await execAsync('git add .')

      const commitMsg = `feat: ${feature}\n\nGenerated with [p/](https://www.prjct.app/)`

      await execFileAsync('git', ['commit', '-m', commitMsg])

      return { success: true, message: 'Committed' }
    } catch (error) {
      // Git commit failed - likely no changes or not a repo
      if (isNotFoundError(error)) {
        return { success: false, message: 'Git not found' }
      }
      return { success: false, message: 'No changes to commit' }
    }
  }

  /**
   * Push to remote
   */
  async _gitPush(_projectPath: string): Promise<{ success: boolean; message: string }> {
    try {
      await execAsync('git push')
      return { success: true, message: 'Pushed to remote' }
    } catch (error) {
      // Git push failed - no remote, auth issue, or git not found
      if (isNotFoundError(error)) {
        return { success: false, message: 'Git not found' }
      }
      return { success: false, message: 'Push failed (no remote or auth issue)' }
    }
  }
}
