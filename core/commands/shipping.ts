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
import { completeActiveTask, resolveActiveTask } from '../services/task-service'
import { getGitBranch } from '../session/git-helpers'
import { prjctDb } from '../storage/database'
import { shippedStorage } from '../storage/shipped-storage'
import { workflowRuleStorage } from '../storage/workflow-rule-storage'
import type { CommandClarification, CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import type { WorkflowRule } from '../types/storage/extended'
import type { WorkflowRunContext } from '../types/workflow.js'
import * as dateHelper from '../utils/date-helper'
import { failFromError } from '../utils/md-aware'
import { mdDone, mdList, mdNextSteps, mdOutput, mdSection } from '../utils/md-formatter'
import { getNextSteps, showNextSteps } from '../utils/next-steps'
import out from '../utils/output'
import { detectProjectCommands } from '../utils/project-commands'
import { executeWorkflowRules } from '../workflow-engine/workflow-engine'
import { PrjctCommandsBase } from './base'
import { requireProject } from './guards'

// kv marker written before the shipped row is recorded and cleared after.
// If a ship pushes a version (via the before-rules) but crashes before
// `addShipped`, this marker survives → the NEXT ship reconciles it
// idempotently, closing the version-divergence class (mem_2920).
const SHIP_MARKER_KEY = 'ship:in_progress'

interface ShipMarker {
  feature: string
  version: string
  startedAt: string
}

type ShipIntent = 'register-only' | 'seed-code-workflow' | 'proceed'

interface ShipOptions {
  skipHooks?: boolean
  md?: boolean
  intent?: ShipIntent
  /** SDD: skip the spec acceptance gate (use only on explicit user override) */
  noSpecGate?: boolean
  /** TDD: skip the test gate surfaced in strict mode (explicit override) */
  noTestGate?: boolean
}

export class ShippingCommands extends PrjctCommandsBase {
  async ship(
    feature: string | null,
    projectPath: string = process.cwd(),
    options: ShipOptions = {}
  ): Promise<CommandResult> {
    try {
      const proj = await requireProject(projectPath)
      if (!proj.ok) return proj.result
      const projectId = proj.value

      // Crash recovery: a prior ship that pushed a version but died before
      // recording the shipped row left a marker. Reconcile it idempotently
      // (skip if that version is already recorded) before doing anything.
      try {
        const stale = prjctDb.getDoc<ShipMarker>(projectId, SHIP_MARKER_KEY)
        if (stale?.version) {
          const already = await shippedStorage.getByVersion(projectId, stale.version)
          if (!already) {
            await shippedStorage.addShipped(projectId, {
              name: stale.feature,
              version: stale.version,
            })
            console.log(`ℹ️  Reconciled an interrupted ship: ${stale.feature} (v${stale.version})`)
          }
          prjctDb.deleteDoc(projectId, SHIP_MARKER_KEY)
        }
      } catch {
        // Best-effort recovery — never block a ship on reconciliation.
      }

      let featureName = normalizeShipFeature(feature)

      // Resolve + complete the task for THIS worktree (main → currentTask,
      // child worktree → its activeTasks[] slot) so parallel agents ship their
      // own work without disturbing sibling worktrees.
      const currentTask = await resolveActiveTask(projectId, projectPath)
      const linkedSpecId = currentTask?.linkedSpecId
      if (currentTask) {
        if (!featureName) featureName = normalizeShipFeature(currentTask.description)
        await completeActiveTask(projectId, projectPath)
      }

      // SDD strict gate (opt-in via config.sdd.mode === 'strict'): refuse to
      // ship work with no linked spec — the pipeline is mandatory in strict.
      // advisory/off never block here. `--no-spec-gate` is the override.
      if (!options.noSpecGate && !linkedSpecId) {
        try {
          const sddConfig = await configManager.readConfig(projectPath).catch(() => null)
          const { effectiveSddMode } = await import('./sdd')
          if (effectiveSddMode(sddConfig) === 'strict') {
            return {
              success: false,
              error:
                'Strict SDD: this work has no linked intent/spec. Start it via `prjct intent` → `audit-spec` → `prjct work --spec <id>`, or override with `prjct ship --no-spec-gate`.',
            }
          }
        } catch {
          // best-effort — never crash ship on the gate lookup
        }
      }

      // SDD acceptance gate: surface the linked spec's acceptance_criteria
      // before ship proceeds. The CLI doesn't decide whether each criterion
      // is met — Claude (or the human) does, per the skill body's `ship`
      // entry. Without --no-spec-gate, we surface and continue; the agent
      // is responsible for halting if any criterion is unmet.
      if (linkedSpecId && !options.noSpecGate) {
        try {
          const { specService } = await import('../services/spec-service')
          const spec = await specService.get(projectPath, linkedSpecId)
          if (spec && spec.content.acceptance_criteria.length > 0) {
            const lines: string[] = []
            lines.push('')
            lines.push(`## Spec acceptance gate — \`${spec.title}\` (${spec.id.slice(0, 8)})`)
            lines.push('')
            lines.push('Walk each criterion. STOP if any is unmet.')
            lines.push('')
            for (const c of spec.content.acceptance_criteria) {
              lines.push(`- [ ] ${c}`)
            }
            lines.push('')
            lines.push('Override (only with explicit user consent): `prjct ship --no-spec-gate`.')
            lines.push('')
            console.log(lines.join('\n'))

            // Also link the eventual PR back to the spec when the user runs
            // `prjct spec ship <id> --pr <n>` after merge — out of scope for
            // this verb; the wiring lives on the spec command instead.
          }
        } catch {
          // ignore — spec lookup is best-effort
        }
      }

      // TDD gate (opt-in via config.tdd.mode): in `strict`, surface a hard
      // reminder to run the project's tests before shipping. Mirrors the spec
      // gate above — the CLI surfaces, the agent honours (running the real
      // red/green via `prjct tdd check`). `assist` is a softer nudge; `off`
      // (the default) is silent. `--no-test-gate` is the explicit override.
      if (!options.noTestGate) {
        try {
          const { effectiveTddMode } = await import('./tdd')
          const tddConfig = await configManager.readConfig(projectPath).catch(() => null)
          const tddMode = effectiveTddMode(tddConfig)
          if (tddMode !== 'off') {
            const detected = await detectProjectCommands(projectPath).catch(() => null)
            const testCmd = detected?.test?.command
            const lines: string[] = ['']
            if (tddMode === 'strict') {
              lines.push('## TDD gate (strict) — tests must be green before ship')
              lines.push('')
              lines.push(
                testCmd
                  ? `Run \`prjct tdd check\` (\`${testCmd}\`). STOP and fix if RED.`
                  : 'No test command detected — add tests (strict TDD expects them).'
              )
              lines.push('Override (only with explicit user consent): `prjct ship --no-test-gate`.')
            } else {
              lines.push('## TDD reminder (assist)')
              lines.push('')
              lines.push(
                testCmd
                  ? `Did the change ship with tests? Verify green: \`prjct tdd check\` (\`${testCmd}\`).`
                  : 'Consider adding a test for this change.'
              )
            }
            lines.push('')
            console.log(lines.join('\n'))
          }
        } catch {
          // ignore — TDD gate is best-effort surfacing
        }
      }

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

      featureName = featureName ?? (await inferShipFeatureFromBranch(projectPath))
      if (!featureName) {
        return {
          success: false,
          error:
            'Ship needs a release description. Pass one explicitly, e.g. `prjct ship "add universal agent compatibility"`, or ship from a named feature branch.',
        }
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

      // The before-rules have already pushed `newVersion`. Drop a marker so
      // a crash between here and `addShipped` is recoverable on the next
      // ship; clear it once the shipped row is durably recorded.
      try {
        prjctDb.setDoc<ShipMarker>(projectId, SHIP_MARKER_KEY, {
          feature: featureName,
          version: newVersion,
          startedAt: dateHelper.getTimestamp(),
        })
      } catch {
        // marker is best-effort — never block the ship
      }

      await shippedStorage.addShipped(projectId, {
        name: featureName,
        version: newVersion,
      })

      try {
        prjctDb.deleteDoc(projectId, SHIP_MARKER_KEY)
      } catch {
        // stale marker is harmless — next ship reconciles it as a no-op
        // (getByVersion finds the row we just wrote → skip)
      }

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

      // Ship-success reinforcement: every memory surfaced during this task
      // just fed work that actually shipped — give it the strong usefulness
      // credit so it ranks higher in future recall. Best-effort; a completed
      // ship must never fail on reinforcement bookkeeping.
      if (currentTask?.id) {
        try {
          const { usefulnessService } = await import('../services/usefulness')
          usefulnessService.creditShippedTask(projectId, currentTask.id)
        } catch {
          /* best-effort */
        }
      }

      // Cloud sync (opt-in): push this ship + pull remote in the background.
      // Fire-and-forget — ship must never block on the network. Safe to not
      // await: the pending queue is durable, so an interrupted flush is
      // retried by the Stop hook / next `prjct cloud sync`. No-op unless the
      // project is linked.
      void (async () => {
        try {
          const { flushIfLinked } = await import('../sync/auto-flush')
          await flushIfLinked(projectPath)
        } catch {
          /* best-effort */
        }
      })()

      return { success: true, feature: featureName, version: newVersion }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return failFromError(error)
    }
  }
}

function normalizeShipFeature(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function inferShipFeatureFromBranch(projectPath: string): Promise<string | null> {
  const branch = await getGitBranch(projectPath)
  if (!branch) return null

  const normalized = branch.replace(/^refs\/heads\//, '').trim()
  if (!normalized || /^(main|master|develop|development|dev|trunk)$/i.test(normalized)) {
    return null
  }

  const leaf = normalized.split('/').filter(Boolean).at(-1) ?? normalized
  if (!leaf || /^\d+(?:\.\d+)*$/.test(leaf)) return null

  const words = leaf
    .replace(/^[a-z]+-\d+[-_]/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return words.length >= 3 ? words : null
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
  const activeTask = await resolveActiveTask(projectId, projectPath)
  if (activeTask) return null

  // Case 3 — no active work cycle but steps exist. Dangerous when there's a
  // PR already open for this branch: we don't know whether the user
  // wants another commit on top or to start fresh. Ask.
  const pr = await findOpenPrForBranch(projectPath)
  if (pr) {
    return {
      question: `No active work cycle, and PR #${pr.number} ("${pr.title}") is OPEN for this branch. Continue ship anyway?`,
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
