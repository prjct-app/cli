/**
 * Shipping Commands — workflow-first dispatcher.
 *
 * ship() has no hardcoded "code pipeline". Version bump, changelog,
 * git commit/push all live as rules in the workflow table (seeded
 * per-project at init based on stack detection). Non-code projects
 * get no rules and ship just records a shipped_features row.
 *
 * If no step rules exist and the project doesn't auto-seed as code,
 * we return a `clarification` instead of acting — the agent is
 * expected to ask the user and re-invoke with an explicit intent.
 */

import { existsSync } from 'node:fs'
import path from 'node:path'
import configManager from '../infrastructure/config-manager'
import { syncService } from '../services/sync-service'
import { shippedStorage } from '../storage/shipped-storage'
import { stateStorage } from '../storage/state-storage'
import { workflowRuleStorage } from '../storage/workflow-rule-storage'
import type { CommandClarification, CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import type { WorkflowRule } from '../types/storage.js'
import type { WorkflowRunContext } from '../types/workflow.js'
import * as dateHelper from '../utils/date-helper'
import { mdDone, mdList, mdNextSteps, mdOutput, mdSection } from '../utils/md-formatter'
import { getNextSteps, showNextSteps } from '../utils/next-steps'
import out from '../utils/output'
import { executeWorkflowRules } from '../workflow/workflow-engine'
import { PrjctCommandsBase } from './base'

type ShipIntent = 'register-only' | 'seed-code-workflow' | 'proceed'

interface ShipOptions {
  skipHooks?: boolean
  md?: boolean
  intent?: ShipIntent
}

export class ShippingCommands extends PrjctCommandsBase {
  async ship(
    feature: string | null,
    projectPath: string = process.cwd(),
    options: ShipOptions = {}
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

      const currentTask = await stateStorage.getCurrentTask(projectId)
      if (currentTask) {
        if (!featureName) featureName = currentTask.description || 'current work'
        await stateStorage.completeTask(projectId)
      }
      if (!featureName) featureName = 'current work'

      let rules = workflowRuleStorage.getRulesForCommand(projectId, 'ship')

      // If the caller explicitly asked to seed, do it up front and continue.
      if (options.intent === 'seed-code-workflow') {
        const seeded = await seedCodeShipRules(projectId, projectPath)
        if (!seeded) {
          return {
            success: false,
            error:
              'seed-code-workflow requested but this project does not look like code (no package.json / Cargo.toml / pyproject.toml / VERSION). Add rules manually with `prjct workflow add`.',
          }
        }
        rules = workflowRuleStorage.getRulesForCommand(projectId, 'ship')
      }

      // Migration path: first ship on an existing code project that
      // predates workflow-first seeding. Silent — log a one-liner so
      // users see what happened.
      const hasSteps = rules.some((r) => r.type === 'step' && r.position === 'before')
      if (!hasSteps && options.intent !== 'register-only') {
        const seeded = await seedCodeShipRules(projectId, projectPath)
        if (seeded) {
          console.log('ℹ️  Auto-seeded code ship workflow (one-time migration)')
          rules = workflowRuleStorage.getRulesForCommand(projectId, 'ship')
        }
      }

      // Ambiguity gate. Only triggers when the caller did NOT pass an
      // explicit intent — callers that have already asked the user
      // (e.g. re-invocation with --intent) skip the gate.
      const clarification = await buildClarification(projectId, projectPath, rules, options)
      if (clarification) {
        renderClarification(clarification, options.md === true)
        return { success: false, clarification }
      }

      const runCtx: WorkflowRunContext = { feature: featureName }

      const beforeResult = await executeWorkflowRules(projectId, 'ship', 'before', {
        projectPath,
        skipRules: options.skipHooks,
        runContext: runCtx,
      })
      if (!beforeResult.success) {
        const failedList =
          beforeResult.gatesFailed.length > 0 ? beforeResult.gatesFailed.join(', ') : 'unknown step'
        return { success: false, error: `Ship blocked: ${failedList}` }
      }

      const newVersion = typeof runCtx.version === 'string' ? runCtx.version : 'unversioned'

      await shippedStorage.addShipped(projectId, {
        name: featureName,
        version: newVersion,
      })

      await this.logToMemory(projectPath, 'feature_shipped', {
        feature: featureName,
        version: newVersion,
        timestamp: dateHelper.getTimestamp(),
      })

      const afterResult = await executeWorkflowRules(projectId, 'ship', 'after', {
        projectPath,
        skipRules: options.skipHooks,
        runContext: runCtx,
      })

      const allInstructions = [...beforeResult.instructions, ...afterResult.instructions]

      try {
        await syncService.sync(projectPath)
      } catch (syncError) {
        console.warn('⚠️  Failed to sync AI context after shipping:', getErrorMessage(syncError))
      }

      try {
        const { regenerateWikiDeferred } = await import('../services/wiki-generator')
        await regenerateWikiDeferred(projectPath, projectId)
      } catch (wikiError) {
        console.warn('⚠️  Wiki regeneration failed (non-blocking):', getErrorMessage(wikiError))
      }

      const stepsRun = beforeResult.stepsRun.length + afterResult.stepsRun.length

      if (options.md) {
        const steps = getNextSteps('ship', true)
        const md = mdOutput(
          mdDone(`Shipped: ${featureName}`, `Version: ${newVersion}`),
          mdSection(
            'Results',
            mdList([
              `Version: ${newVersion}`,
              `Workflow steps run: ${stepsRun > 0 ? [...beforeResult.stepsRun, ...afterResult.stepsRun].join(', ') : 'none'}`,
              `Hooks failed (non-blocking): ${beforeResult.hooksFailed.length + afterResult.hooksFailed.length}`,
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
}

function isCodeProject(projectPath: string): boolean {
  const markers = [
    'package.json',
    'Cargo.toml',
    'pyproject.toml',
    'go.mod',
    'Gemfile',
    'pom.xml',
    'build.gradle',
    'VERSION',
  ]
  return markers.some((m) => existsSync(path.join(projectPath, m)))
}

function isGitRepo(projectPath: string): boolean {
  return existsSync(path.join(projectPath, '.git'))
}

/**
 * Seed the 4 code-default ship steps (version:bump, changelog:add,
 * git:commit, git:push) if this project looks like code. Returns true
 * when rules were added.
 *
 * Delegates the "does this look like code?" check to isCodeProject
 * here (instead of detectProjectCommands) because we want ship's
 * migration path to stay decoupled from planning.ts internals.
 */
export async function seedCodeShipRules(projectId: string, projectPath: string): Promise<boolean> {
  if (!isCodeProject(projectPath)) return false

  const now = new Date().toISOString()
  const existing = workflowRuleStorage.getRulesForCommand(projectId, 'ship')
  const existingActions = new Set(existing.map((r) => r.action))
  // Seeded rules are sorted after any user-authored rules. Start from
  // max(existing) + 1 so we don't collide.
  const maxSort = existing.reduce((m, r) => Math.max(m, r.sortOrder ?? 0), 0)
  let sort = maxSort + 1

  // Gate: refuse to ship from main/master. Auto-seed used to skip this
  // and only add the 4 steps, so projects that predated workflow-first
  // would happily bump + commit + push from main. Seed it here too so
  // the migration and fresh-init paths produce the same rule set.
  const gates: Array<{ action: string; description: string; timeoutMs: number }> = []
  if (isGitRepo(projectPath)) {
    gates.push({
      action: 'git branch --show-current | grep -vE "^(main|master)$"',
      description: 'Prevent shipping from main branch',
      timeoutMs: 5000,
    })
  }

  const steps: Array<{ action: string; description: string; timeoutMs: number }> = [
    { action: 'version:bump', description: 'Bump version (stack-aware)', timeoutMs: 10000 },
    { action: 'changelog:add', description: 'Append CHANGELOG entry', timeoutMs: 10000 },
  ]
  if (isGitRepo(projectPath)) {
    steps.push({ action: 'git:commit', description: 'Commit ship', timeoutMs: 15000 })
    steps.push({ action: 'git:push', description: 'Push to origin', timeoutMs: 30000 })
  }

  let added = 0
  for (const g of gates) {
    if (existingActions.has(g.action)) continue
    workflowRuleStorage.addRule(projectId, {
      type: 'gate',
      command: 'ship',
      position: 'before',
      action: g.action,
      description: g.description,
      enabled: true,
      timeoutMs: g.timeoutMs,
      sortOrder: sort++,
      createdAt: now,
    })
    added++
  }
  for (const s of steps) {
    if (existingActions.has(s.action)) continue
    workflowRuleStorage.addRule(projectId, {
      type: 'step',
      command: 'ship',
      position: 'before',
      action: s.action,
      description: s.description,
      enabled: true,
      timeoutMs: s.timeoutMs,
      sortOrder: sort++,
      createdAt: now,
    })
    added++
  }

  return added > 0
}

/**
 * Inspect state and decide whether ship can proceed autonomously. When
 * we're unsure, return a clarification object; the dispatcher lifts it
 * into CommandResult.clarification and the agent surfaces the question
 * to the user.
 */
async function buildClarification(
  projectId: string,
  projectPath: string,
  rules: WorkflowRule[],
  options: ShipOptions
): Promise<CommandClarification | null> {
  // If caller already expressed intent, trust them.
  if (options.intent === 'proceed' || options.intent === 'register-only') return null

  const hasSteps = rules.some((r) => r.type === 'step' && r.position === 'before')

  // Case 1 — no steps configured at all. Auto-seed already ran, so
  // arriving here means the project isn't code (or migration failed).
  if (!hasSteps) {
    return {
      question: 'No `ship` workflow steps are configured for this project. What should ship do?',
      options: ['register-only', 'seed-code-workflow', 'abort'],
      state: {
        rulesCount: rules.length,
        looksLikeCode: isCodeProject(projectPath),
      },
    }
  }

  // Case 2 — steps are defined AND there's an active task → proceed.
  const activeTask = await stateStorage.getCurrentTask(projectId)
  if (activeTask) return null

  // Case 3 — no active task but steps exist. Dangerous when there's a
  // PR already open for this branch: we don't know whether the user
  // wants another commit on top or to start fresh. Ask.
  const pr = await findOpenPrForBranch(projectPath)
  if (pr) {
    return {
      question: `No active task, and PR #${pr.number} ("${pr.title}") is OPEN for this branch. Continue ship anyway?`,
      options: ['proceed', 'abort'],
      state: { openPr: pr.number, branch: pr.branch },
    }
  }

  // Case 4 — steps exist, no task, no PR. Nothing obviously wrong;
  // proceed. The configured gate step (e.g. "not on main") handles the
  // rest.
  return null
}

function renderClarification(c: CommandClarification, md: boolean): void {
  if (md) {
    const body = mdOutput(
      mdSection(`Clarification needed`, c.question),
      mdSection('Options', mdList(c.options.map((o) => `\`prjct ship --intent=${o}\``))),
      c.state
        ? mdSection(
            'State',
            mdList(Object.entries(c.state).map(([k, v]) => `${k}: ${JSON.stringify(v)}`))
          )
        : null
    )
    console.log(body)
    return
  }
  console.log(`\n⚠️  ${c.question}`)
  console.log('\nOptions:')
  for (const o of c.options) {
    console.log(`  prjct ship --intent=${o}`)
  }
}

async function findOpenPrForBranch(
  projectPath: string
): Promise<{ number: number; title: string; branch: string } | null> {
  if (!isGitRepo(projectPath)) return null
  try {
    const { execFileAsync } = await import('../utils/exec')
    const { stdout: branch } = await execFileAsync('git', ['branch', '--show-current'], {
      cwd: projectPath,
      timeout: 3000,
    })
    const head = branch.toString().trim()
    if (!head) return null
    const { stdout } = await execFileAsync(
      'gh',
      ['pr', 'list', '--head', head, '--state', 'open', '--json', 'number,title', '--limit', '1'],
      { cwd: projectPath, timeout: 5000 }
    )
    const parsed = JSON.parse(stdout.toString()) as Array<{ number: number; title: string }>
    if (parsed.length === 0) return null
    return { number: parsed[0].number, title: parsed[0].title, branch: head }
  } catch {
    // gh missing, no auth, or non-github remote — treat as "no PR".
    return null
  }
}
