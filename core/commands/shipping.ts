/**
 * Shipping Commands: ship and related helpers
 * Write-Through Architecture: JSON → MD → Event
 */

import path from 'node:path'
import memorySystem from '../agentic/memory-system'
import { shippedStorage, stateStorage } from '../storage'
import type { CommandResult } from '../types'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import { showNextSteps } from '../utils/next-steps'
import { detectProjectCommands } from '../utils/project-commands'
import { runWorkflowHooks } from '../workflow/workflow-preferences'
import { configManager, dateHelper, fileHelper, out, PrjctCommandsBase, toolRegistry } from './base'

export class ShippingCommands extends PrjctCommandsBase {
  /**
   * Run a command and capture exit code without throwing.
   *
   * Reason: `toolRegistry.Bash` swallows non-zero exits into stderr; we still want a reliable success flag.
   */
  private async _runWithExitCode(command: string): Promise<{ exitCode: number; output: string }> {
    const bash = toolRegistry.get('Bash')!
    const escaped = command.replace(/"/g, '\\"')
    const wrapped = `bash -lc "set +e; ${escaped} 2>&1; echo __EXIT:$?"`
    const result = (await bash(wrapped)) as { stdout: string; stderr: string }
    const output = `${result.stdout}\n${result.stderr}`.trim()

    const lines = output.split('\n')
    let marker: string | undefined
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith('__EXIT:')) {
        marker = lines[i]
        break
      }
    }
    const exitCode = marker ? Number(marker.replace('__EXIT:', '').trim()) : 1

    // Remove marker from output for cleaner logs
    const cleaned = output
      .split('\n')
      .filter((line) => !line.startsWith('__EXIT:'))
      .join('\n')
      .trim()

    return { exitCode: Number.isFinite(exitCode) ? exitCode : 1, output: cleaned }
  }

  /**
   * /p:ship - Ship feature with complete automated workflow
   */
  async ship(
    feature: string | null,
    projectPath: string = process.cwd(),
    options: { skipHooks?: boolean } = {}
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
      if (!featureName) {
        // Read from storage (JSON is source of truth)
        const currentTask = await stateStorage.getCurrentTask(projectId)
        featureName = currentTask?.description || 'current work'
      }

      // Run before_ship hooks (using memory-based preferences)
      const beforeResult = await runWorkflowHooks(projectId, 'before', 'ship', {
        projectPath,
        skipHooks: options.skipHooks,
      })
      if (!beforeResult.success) {
        return { success: false, error: `Hook failed: ${beforeResult.failed}` }
      }

      // Ship steps with progress indicator
      out.step(1, 5, `Linting ${featureName}...`)
      const lintResult = await this._runLint(projectPath)

      out.step(2, 5, 'Running tests...')
      const testResult = await this._runTests(projectPath)

      out.step(3, 5, 'Updating version...')
      const newVersion = await this._bumpVersion(projectPath)
      await this._updateChangelog(featureName, newVersion, projectPath)

      out.step(4, 5, 'Committing...')
      const commitResult = await this._createShipCommit(featureName, projectPath)

      if (commitResult.success) {
        out.step(5, 5, 'Pushing...')
        await this._gitPush(projectPath)
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

      if (testResult.success) {
        await memorySystem.recordDecision(projectId, 'test_before_ship', 'true', 'ship')
      }

      const isQuickShip = !lintResult.success || !testResult.success
      if (isQuickShip) {
        await memorySystem.recordWorkflow(projectId, 'quick_ship', {
          description: 'Ship without full checks',
          feature_type: featureName.toLowerCase().includes('doc') ? 'docs' : 'other',
        })
      }

      // Run after_ship hooks
      await runWorkflowHooks(projectId, 'after', 'ship', {
        projectPath,
        skipHooks: options.skipHooks,
      })

      out.done(`v${newVersion} shipped`)
      showNextSteps('ship')

      return { success: true, feature: featureName, version: newVersion }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Run lint checks
   */
  async _runLint(projectPath: string): Promise<{ success: boolean; message: string }> {
    try {
      const detected = await detectProjectCommands(projectPath)
      if (!detected.lint) return { success: true, message: 'skipped (no lint detected)' }

      const { exitCode } = await this._runWithExitCode(detected.lint.command)
      return { success: exitCode === 0, message: exitCode === 0 ? 'passed' : 'failed' }
    } catch (error) {
      // Lint detection/execution failed - skip gracefully
      if (isNotFoundError(error)) {
        return { success: true, message: 'skipped (lint not found)' }
      }
      return { success: true, message: 'skipped (lint detection failed)' }
    }
  }

  /**
   * Run tests
   */
  async _runTests(projectPath: string): Promise<{ success: boolean; message: string }> {
    try {
      const detected = await detectProjectCommands(projectPath)
      if (!detected.test) return { success: true, message: 'skipped (no tests detected)' }

      const { exitCode } = await this._runWithExitCode(detected.test.command)
      return { success: exitCode === 0, message: exitCode === 0 ? 'passed' : 'failed' }
    } catch (error) {
      // Test detection/execution failed - skip gracefully
      if (isNotFoundError(error)) {
        return { success: true, message: 'skipped (tests not found)' }
      }
      return { success: true, message: 'skipped (test detection failed)' }
    }
  }

  /**
   * Bump version
   */
  async _bumpVersion(projectPath: string): Promise<string> {
    try {
      const pkgPath = path.join(projectPath, 'package.json')
      const pkg = await fileHelper.readJson<{ version?: string }>(pkgPath, { version: '0.0.0' })
      const oldVersion = pkg?.version || '0.0.0'
      const [major, minor, patch] = oldVersion.split('.').map(Number)
      const newVersion = `${major}.${minor}.${patch + 1}`
      if (pkg) {
        pkg.version = newVersion
        await fileHelper.writeJson(pkgPath, pkg)
      }
      return newVersion
    } catch (error) {
      // No package.json or parse error - return default version
      if (isNotFoundError(error) || error instanceof SyntaxError) {
        return '0.0.1'
      }
      throw error
    }
  }

  /**
   * Update CHANGELOG
   */
  async _updateChangelog(feature: string, version: string, projectPath: string): Promise<void> {
    try {
      const changelogPath = path.join(projectPath, 'CHANGELOG.md')
      const changelog = await fileHelper.readFile(changelogPath, '# Changelog\n\n')

      const entry = `## [${version}] - ${dateHelper.formatDate(new Date())}\n\n### Added\n- ${feature}\n\n`
      const updated = changelog.replace('# Changelog\n\n', `# Changelog\n\n${entry}`)

      await fileHelper.writeFile(changelogPath, updated)
    } catch (error) {
      // CHANGELOG doesn't exist or can't be written - warn but continue
      if (isNotFoundError(error)) {
        console.error('   Warning: CHANGELOG.md not found')
      } else {
        console.error('   Warning: Could not update CHANGELOG')
      }
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
      await toolRegistry.get('Bash')!('git add .')

      const commitMsg = `feat: ${feature}\n\nGenerated with [p/](https://www.prjct.app/)`

      await toolRegistry.get('Bash')!(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`)

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
      await toolRegistry.get('Bash')!('git push')
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
