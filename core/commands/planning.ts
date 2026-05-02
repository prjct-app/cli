/**
 * Planning Commands: init, feature, bug, idea, spec
 * Write-Through Architecture: JSON → MD → Event
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import * as authorDetector from '../infrastructure/author-detector'
import commandInstaller from '../infrastructure/command-installer'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import { writeProjectClaudeMd } from '../services/project-claude-md'
import { workflowRuleStorage } from '../storage/workflow-rule-storage'
import type { CommandResult, InitOptions } from '../types/commands'
import { getErrorMessage } from '../types/fs'
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
   * /p:init - Initialize prjct project with interactive wizard
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
      const globalPath = pathManager.getGlobalProjectPath(projectId)

      // Seed default workflow rules for ship
      await this._seedShipWorkflow(projectId, projectPath)

      const baseFiles: Record<string, string> = {
        'core/now.md': '# NOW\n\nNo current task. Use `/p:now` to set focus.\n',
        'core/next.md': '# NEXT\n\n## Priority Queue\n\n',
        'core/context.md': '# CONTEXT\n\n',
        'progress/shipped.md': '# SHIPPED 🚀\n\n',
        'progress/metrics.md': '# METRICS\n\n',
        'planning/ideas.md': '# IDEAS 💡\n\n## Brain Dump\n\n',
        'planning/roadmap.md': '# ROADMAP\n\n',
        'memory/context.jsonl': '',
        'memory/patterns.json': JSON.stringify(
          {
            version: 1,
            decisions: {},
            preferences: {},
            workflows: {},
            counters: {},
          },
          null,
          2
        ),
      }

      // Save wizard preferences if available
      if (wizardResult) {
        baseFiles['config/wizard.json'] = JSON.stringify(
          {
            projectType: wizardResult.projectType,
            agents: wizardResult.agents,
            stack: wizardResult.stack,
            preferences: wizardResult.preferences,
            createdAt: new Date().toISOString(),
          },
          null,
          2
        )
      }

      for (const [filePath, content] of Object.entries(baseFiles)) {
        await fs.writeFile(path.join(globalPath, filePath), content)
      }

      const isEmpty = await this._detectEmptyDirectory(projectPath)
      const hasCode = await this._detectExistingCode(projectPath)

      if (hasCode || !isEmpty) {
        out.step(3, 4, 'Analyzing project...')
        const analysis = await getAnalysisCommands()
        const analysisResult = await analysis.analyze({}, projectPath)

        if (analysisResult.success) {
          out.step(4, 4, 'Generating agents...')

          // Pass wizard agent selection to sync if available
          await analysis.sync(projectPath)

          out.done('initialized')
          this._printNextSteps(wizardResult)
          return { success: true, mode: 'existing', projectId, wizard: wizardResult }
        }
      }

      const idea = opts.idea
      if (isEmpty && !hasCode) {
        if (!idea) {
          out.done('blank project - provide idea for architect mode')
          return { success: true, mode: 'blank_no_idea', projectId, wizard: wizardResult }
        }

        out.spin('architect mode...')
        const sessionPath = path.join(globalPath, 'planning', 'architect-session.md')
        const sessionContent = `# Architect Session\n\n## Idea\n${idea}\n\n## Status\nInitialized - awaiting stack recommendation\n\nGenerated: ${new Date().toLocaleString()}\n`
        await fs.writeFile(sessionPath, sessionContent)

        await commandInstaller.installGlobalConfig()

        out.done('architect mode ready')
        return { success: true, mode: 'architect', projectId, idea, wizard: wizardResult }
      }

      await commandInstaller.installGlobalConfig()
      // Write the per-project CLAUDE.md routing block so Claude Code
      // sessions in this directory pick up the prjct contract on cwd
      // entry. Best-effort — a missing/locked file degrades silently.
      await writeProjectClaudeMd(projectPath).catch(() => {})

      out.done('initialized')
      this._printNextSteps(wizardResult)
      return { success: true, projectId, wizard: wizardResult }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Print next steps after initialization
   */
  private _printNextSteps(wizardResult: import('../types/workflows').WizardResult | null): void {
    console.log('')
    console.log('  ✓ skill installed at ~/.claude/skills/prjct/')
    console.log('  ✓ project CLAUDE.md updated with routing block')
    console.log('')
    console.log("  You don't run prjct commands. Claude does.")
    console.log('')
    console.log("  Just describe what you're doing — Claude reads the intent and")
    console.log('  runs the right verb. Routine captures (decision, learning,')
    console.log('  gotcha, idea) save automatically; ship and other destructive')
    console.log('  verbs surface a one-line plan and wait for your OK.')
    console.log('')
    console.log('  If you want to drive manually:')
    console.log('    prjct sync       Refresh context + skill body')
    console.log('    prjct task       Start a task')
    console.log('    prjct hooks      Auto-sync on commit/checkout')
    console.log('')

    if (wizardResult) {
      const agentFiles = wizardResult.agents
        .map((a) => {
          switch (a) {
            case 'claude':
              return 'CLAUDE.md'
            case 'cursor':
              return '.cursorrules'
            case 'windsurf':
              return '.windsurfrules'
            case 'copilot':
              return '.github/copilot-instructions.md'
            case 'gemini':
              return 'GEMINI.md'
            case 'codex':
              return 'AGENTS.md'
            default:
              return null
          }
        })
        .filter(Boolean)

      if (agentFiles.length > 0) {
        console.log(`  Generated: ${agentFiles.join(', ')}`)
        console.log('')
      }
    }

    console.log('  Docs: https://prjct.app/docs')
    console.log('')
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
