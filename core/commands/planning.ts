/**
 * Planning Commands: init, feature, bug, idea, spec
 * Write-Through Architecture: JSON → MD → Event
 */

import * as authorDetector from '../infrastructure/author-detector'
import commandInstaller from '../infrastructure/command-installer'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import {
  type ProjectAgentSurfacesResult,
  writeProjectAgentSurfaces,
} from '../services/project-agent-surfaces'
import { workflowRuleStorage } from '../storage/workflow-rule-storage'
import type { CommandResult, InitOptions } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { failFromError } from '../utils/md-aware'
import out from '../utils/output'
import { detectProjectCommands } from '../utils/project-commands'
import { OnboardingWizard } from '../workflows/onboarding'
import { PrjctCommandsBase } from './base'

// Lazy-loaded to avoid circular dependencies
let _analysisCommands: import('./analysis').AnalysisCommands | null = null
async function getAnalysisCommands(): Promise<import('./analysis').AnalysisCommands> {
  if (!_analysisCommands) {
    const { AnalysisCommands } = await import('./analysis')
    _analysisCommands = new AnalysisCommands()
  }
  return _analysisCommands
}

export class PlanningCommands extends PrjctCommandsBase {
  /**
   * p. init - Initialize prjct project with interactive wizard
   *
   * @param options.yes - Skip wizard, use auto-detected values (for CI)
   * @param options.idea - Initial idea for architect mode
   * @param projectPath - Project directory path
   */
  async init(
    options: InitOptions | string | null = {},
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    try {
      // Handle legacy signature: init(idea, projectPath)
      let opts: InitOptions = {}
      if (typeof options === 'string' || options === null) {
        opts = { idea: options }
      } else {
        opts = options
      }

      await this.initializeAgent()

      const isConfigured = await configManager.isConfigured(projectPath)

      if (isConfigured) {
        out.warn('already initialized')
        return { success: false, message: 'Already initialized' }
      }

      // Determine if we should run interactive wizard
      const isTTY = process.stdout.isTTY && process.stdin.isTTY
      // CI: Skip interactive prompts in CI environments
      const skipWizard = opts.yes || !isTTY || process.env.CI === 'true'

      // Run wizard if interactive
      let wizardResult = null
      if (!skipWizard) {
        const wizard = new OnboardingWizard(projectPath)
        wizardResult = await wizard.run()

        if (wizardResult.skipped) {
          return { success: false, message: 'Setup cancelled' }
        }
      } else if (isTTY && opts.yes) {
        // Non-interactive but show progress
        const wizard = new OnboardingWizard(projectPath)
        wizardResult = await wizard.runNonInteractive()
      }

      out.step(1, 4, 'Detecting author...')

      const detectedAuthor = await authorDetector.detect()
      // Convert null to undefined for createConfig
      const author = {
        name: detectedAuthor.name || undefined,
        email: detectedAuthor.email || undefined,
        github: detectedAuthor.github || undefined,
      }
      const config = await configManager.createConfig(projectPath, author)
      const projectId = config.projectId

      // Apply --pack / --persona into the config so hooks (SessionStart, etc.)
      // can read them immediately. Packs declare signals only — activation
      // never writes workflow scripts. Auto-detect fires when neither flag
      // is explicitly set so fresh repos still get sensible defaults.
      await this._applyInitialPacksAndPersona(projectPath, opts)

      out.step(2, 4, 'Creating structure...')

      await pathManager.ensureProjectStructure(projectId)

      // Seed default workflow rules for ship
      await this._seedShipWorkflow(projectId, projectPath)

      // prjct state — current task / next / context, shipped, metrics,
      // ideas, patterns, wizard prefs — lives ONLY in SQLite
      // (StorageManager → prjct.db) and is surfaced through the
      // regenerated vault. We deliberately do NOT seed legacy
      // write-through stub files (core/*.md, progress/*.md,
      // planning/*.md, memory/patterns.json, config/wizard.json) into
      // the global project folder: nothing ever read them back, so they
      // accumulated as orphaned garbage with no DB record. Nothing is
      // persisted outside prjct.

      const isEmpty = await this._detectEmptyDirectory(projectPath)
      const hasCode = await this._detectExistingCode(projectPath)

      if (hasCode || !isEmpty) {
        out.step(3, 4, 'Analyzing project...')
        const analysis = await getAnalysisCommands()
        const analysisResult = await analysis.analyze({}, projectPath)

        if (analysisResult.success) {
          out.step(4, 4, 'Generating agents...')

          await analysis.sync(projectPath)

          const surfaces = await writeProjectAgentSurfaces(projectPath, {
            agents: await this._agentSelections(wizardResult, projectPath),
          }).catch(() => null)

          out.done('initialized')
          this._printNextSteps(wizardResult, surfaces ?? undefined)
          return { success: true, mode: 'existing', projectId, wizard: wizardResult }
        }
      }

      const idea = opts.idea
      if (isEmpty && !hasCode) {
        if (!idea) {
          await commandInstaller.installGlobalConfig()
          const surfaces = await writeProjectAgentSurfaces(projectPath, {
            agents: await this._agentSelections(wizardResult, projectPath),
          }).catch(() => null)
          out.done('blank project - provide idea for architect mode')
          this._printNextSteps(wizardResult, surfaces ?? undefined)
          return { success: true, mode: 'blank_no_idea', projectId, wizard: wizardResult }
        }

        out.spin('architect mode...')
        // The architect idea is project state — it goes INTO prjct
        // (SQLite + regenerated vault), never a loose planning/*.md that
        // would orphan with no DB record.
        const { projectMemory } = await import('../memory/project-memory')
        await projectMemory.remember(projectPath, {
          type: 'idea',
          content: idea,
          tags: { source: 'architect-init', status: 'awaiting-stack-recommendation' },
          source: 'architect-init',
        })

        await commandInstaller.installGlobalConfig()
        const surfaces = await writeProjectAgentSurfaces(projectPath, {
          agents: await this._agentSelections(wizardResult, projectPath),
        }).catch(() => null)

        out.done('architect mode ready')
        this._printNextSteps(wizardResult, surfaces ?? undefined)
        return { success: true, mode: 'architect', projectId, idea, wizard: wizardResult }
      }

      await commandInstaller.installGlobalConfig()
      const surfaces = await writeProjectAgentSurfaces(projectPath, {
        agents: await this._agentSelections(wizardResult, projectPath),
      }).catch(() => null)

      out.done('initialized')
      this._printNextSteps(wizardResult, surfaces ?? undefined)
      return { success: true, projectId, wizard: wizardResult }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return failFromError(error)
    }
  }

  /**
   * Print next steps after initialization
   */
  private _printNextSteps(
    wizardResult: import('../types/workflows').WizardResult | null,
    surfaces?: ProjectAgentSurfacesResult
  ): void {
    console.log('')
    console.log('  ✓ global prjct router refreshed where supported')
    if (surfaces?.claudeMd) {
      console.log('  ✓ project CLAUDE.md updated with routing block')
    }
    if (surfaces?.agentsMd) {
      console.log('  ✓ project AGENTS.md updated with universal routing block')
    }
    if ((surfaces?.ideRules.length ?? 0) > 0) {
      console.log(`  ✓ project IDE rules updated: ${surfaces?.ideRules.join(', ')}`)
    }
    console.log('')
    console.log("  You don't run prjct commands. Your AI coding agent does.")
    console.log('')
    console.log("  Just describe what you're doing — the agent reads the intent and")
    console.log('  runs the right verb. Routine captures (decision, learning,')
    console.log('  gotcha, idea) save automatically; ship and other destructive')
    console.log('  verbs surface a one-line plan and wait for your OK.')
    console.log('')
    console.log('  If you want to drive manually:')
    console.log('    prjct sync       Refresh context + skill body')
    console.log('    prjct work       Start a work cycle')
    console.log('    prjct hooks      Auto-sync on commit/checkout')
    console.log('')

    if (wizardResult && wizardResult.agents.length > 0) {
      console.log(`  Detected agents: ${wizardResult.agents.join(', ')}`)
      console.log('')
    }

    console.log('  Docs: https://prjct.app/docs')
    console.log('')
  }

  private async _agentSelections(
    wizardResult: import('../types/workflows').WizardResult | null,
    projectPath: string
  ): Promise<readonly string[]> {
    if (wizardResult) return wizardResult.agents
    try {
      const { detectInstalledAgents } = await import('../workflows/onboarding/detection')
      return detectInstalledAgents(projectPath)
    } catch {
      return []
    }
  }

  /**
   * Apply `--pack` / `--persona` flags — or auto-detect when neither is
   * set — into the fresh config. Declarative: sets `persona.role`,
   * `persona.mcps`, `persona.packs`. No scripts written.
   */
  private async _applyInitialPacksAndPersona(
    projectPath: string,
    opts: InitOptions
  ): Promise<void> {
    const { activatePacks, detectSuggestedPacks } = await import('../packs/pack-manager')
    let packNames: string[] = []
    if (opts.pack) {
      packNames = opts.pack
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    } else if (!opts.persona) {
      // No explicit intent from the caller → fall back to auto-detect so
      // fresh repos still get sensible default packs (e.g. code+daily
      // on a package.json repo).
      packNames = await detectSuggestedPacks(projectPath)
    }

    if (packNames.length > 0) {
      await activatePacks(projectPath, packNames, { suggestPersona: true })
    }

    // If the caller explicitly set a persona role, lift it into config.
    if (opts.persona) {
      const configManagerInner = (await import('../infrastructure/config-manager')).default
      const existing = await configManagerInner.readConfig(projectPath)
      if (existing) {
        const persona = existing.persona ?? { role: opts.persona }
        persona.role = opts.persona
        await configManagerInner.writeConfig(projectPath, { ...existing, persona })
      }
    }
  }

  /**
   * Seed default workflow rules for ship command.
   * Creates sensible defaults based on detected project tools.
   */
  private async _seedShipWorkflow(projectId: string, projectPath: string): Promise<void> {
    const detected = await detectProjectCommands(projectPath)
    let sortOrder = 0

    // Workflow-first core: version bump, changelog, git commit/push live
    // as rules seeded here. Non-code projects get none and ship reduces
    // to a shipped_features write + clarification for ambiguous runs.
    const { seedCodeShipRules } = await import('./shipping')
    await seedCodeShipRules(projectId, projectPath)
    // seedCodeShipRules picks its own sortOrder starting after existing
    // rules. Re-align our local counter so gate/lint/test land after.
    sortOrder =
      workflowRuleStorage
        .getRulesForCommand(projectId, 'ship')
        .reduce((m, r) => Math.max(m, r.sortOrder ?? 0), 0) + 1

    // Gate: Prevent shipping from main/master
    workflowRuleStorage.addRule(projectId, {
      type: 'gate',
      command: 'ship',
      position: 'before',
      action: 'git branch --show-current | grep -vE "^(main|master)$"',
      description: 'Prevent shipping from main branch',
      enabled: true,
      timeoutMs: 5000,
      sortOrder: sortOrder++,
      createdAt: new Date().toISOString(),
    })

    // Step: Lint (if detected, non-blocking with || true)
    if (detected.lint) {
      workflowRuleStorage.addRule(projectId, {
        type: 'step',
        command: 'ship',
        position: 'before',
        action: `${detected.lint.command} || true`,
        description: 'Lint code',
        enabled: true,
        timeoutMs: 120000,
        sortOrder: sortOrder++,
        createdAt: new Date().toISOString(),
      })
    }

    // Step: Test (if detected, non-blocking with || true)
    if (detected.test) {
      workflowRuleStorage.addRule(projectId, {
        type: 'step',
        command: 'ship',
        position: 'before',
        action: `${detected.test.command} || true`,
        description: 'Run tests',
        enabled: true,
        timeoutMs: 300000,
        sortOrder: sortOrder++,
        createdAt: new Date().toISOString(),
      })
    }
  }
}
