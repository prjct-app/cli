/**
 * Shipping Commands: ship and related helpers
 * Write-Through Architecture: JSON → MD → Event
 */

import path from 'path'

import memorySystem from '../agentic/memory-system'
import type { CommandResult } from './types'
import {
  PrjctCommandsBase,
  toolRegistry,
  configManager,
  fileHelper,
  dateHelper,
  out
} from './base'
import { stateStorage, shippedStorage } from '../storage'

export class ShippingCommands extends PrjctCommandsBase {
  /**
   * /p:ship - Ship feature with complete automated workflow
   */
  async ship(feature: string | null, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const config = await configManager.readConfig(projectPath)
      const projectId = config!.projectId

      let featureName = feature
      if (!featureName) {
        // Read from storage (JSON is source of truth)
        const currentTask = await stateStorage.getCurrentTask(projectId)
        featureName = currentTask?.description || 'current work'
      }

      out.spin(`shipping ${featureName}...`)

      const lintResult = await this._runLint(projectPath)

      out.spin('running tests...')
      const testResult = await this._runTests(projectPath)

      out.spin('updating version...')
      const newVersion = await this._bumpVersion(projectPath)
      await this._updateChangelog(featureName, newVersion, projectPath)

      out.spin('committing...')
      const commitResult = await this._createShipCommit(featureName, projectPath)

      if (commitResult.success) {
        out.spin('pushing...')
        await this._gitPush(projectPath)
      }

      // Write-through: Record shipped feature (JSON → MD → Event)
      await shippedStorage.addShipped(projectId, {
        name: featureName,
        version: newVersion
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
          feature_type: featureName.toLowerCase().includes('doc') ? 'docs' : 'other'
        })
      }

      out.done(`v${newVersion} shipped`)

      return { success: true, feature: featureName, version: newVersion }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Run lint checks
   */
  async _runLint(_projectPath: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await toolRegistry.get('Bash')!('npm run lint 2>&1 || true') as { stdout: string; stderr: string }
      return { success: !result.stderr.includes('error'), message: 'passed' }
    } catch {
      return { success: false, message: 'no lint script (skipped)' }
    }
  }

  /**
   * Run tests
   */
  async _runTests(_projectPath: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await toolRegistry.get('Bash')!(
        'npm test -- --passWithNoTests 2>&1 || true'
      ) as { stdout: string; stderr: string }
      return { success: !result.stderr.includes('FAIL'), message: 'passed' }
    } catch {
      return { success: false, message: 'no test script (skipped)' }
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
    } catch {
      return '0.0.1'
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
    } catch {
      console.error('   Warning: Could not update CHANGELOG')
    }
  }

  /**
   * Create git commit for ship
   */
  async _createShipCommit(feature: string, _projectPath: string): Promise<{ success: boolean; message: string }> {
    try {
      await toolRegistry.get('Bash')!('git add .')

      const commitMsg = `feat: ${feature}\n\n🤖 Generated with [p/](https://www.prjct.app/)\nDesigned for [Claude](https://www.anthropic.com/claude)`

      await toolRegistry.get('Bash')!(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`)

      return { success: true, message: 'Committed' }
    } catch {
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
    } catch {
      return { success: false, message: 'Push failed (no remote or auth issue)' }
    }
  }
}
