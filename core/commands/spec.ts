/**
 * `prjct spec` — Spec-Driven Development primitive.
 *
 *   prjct spec "<title>"                    # create draft (Claude fills body)
 *   prjct spec list [--status <s>]          # ranked by created_at
 *   prjct spec show <id>                    # render one (--md for vault format)
 *   prjct spec update <id> --json '{...}'   # PATCH content (shallow merge, Zod-validated)
 *   prjct spec set-status <id> <status>     # draft|reviewed|in_progress|shipped|archived
 *   prjct spec record-review <id> <reviewer> <pass|fail> --notes "..."
 *   prjct spec link-task <id> <task-id>
 *   prjct spec ship <id> [--pr <n>]
 *   prjct spec audit <id>                   # emits subagent dispatch prompt
 *
 * The CLI persists state. Claude does the structured drafting (asking the
 * forcing questions, populating acceptance_criteria) and the audit
 * subagent dispatch — see the `spec` and `audit-spec` verbs in the skill
 * body's intent map.
 */

import { specService } from '../services/spec-service'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import {
  SPEC_REVIEWERS,
  SPEC_STATUSES,
  type SpecContent,
  SpecContentSchema,
  type SpecReviewer,
  type SpecStatus,
} from '../types/spec'
import { failHard, failWith } from '../utils/md-aware'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

interface SpecCmdOptions {
  md?: boolean
  status?: string
  json?: string | boolean
  notes?: string
  tags?: string
  pr?: number | string
  goal?: string
  /** Phase 1.6 / B-CTX: skip auto-inferring codebase context on draft. */
  skipContext?: boolean
}

export class SpecCommands extends PrjctCommandsBase {
  /**
   * Default verb: `prjct spec "<title>"` creates a new draft. The body
   * fields default to empty — Claude fills them via the skill's spec
   * intent flow. `--goal "..."` lets a CLI user pre-populate the goal.
   */
  async draft(
    title: string | null = null,
    projectPath: string = process.cwd(),
    options: SpecCmdOptions = {}
  ): Promise<CommandResult> {
    try {
      if (!title || !title.trim()) {
        out.info('Usage: prjct spec "<title>" [--goal "..."] [--tags k:v,...]')
        return { success: false, error: 'Title required' }
      }

      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const goal = options.goal?.trim() || title.trim()
      const tags = parseFlagTags(options.tags)

      const spec = await specService.create(projectPath, {
        title: title.trim(),
        content: { goal },
        tags,
        autoContext: !options.skipContext,
      })

      if (options.md) {
        console.log(
          `✓ spec drafted: ${spec.title}\n\nspec_id: ${spec.id}\nstatus: ${spec.status}\ngoal: ${spec.content.goal}\n\nNext: fill acceptance_criteria, scope, out_of_scope, risks, test_plan via \`prjct spec update ${spec.id} --json '{...}'\` then run \`prjct spec audit ${spec.id}\`.`
        )
      } else {
        out.done(`spec drafted: ${spec.title}`)
        out.info(`  id: ${spec.id}`)
        out.info(`  goal: ${spec.content.goal}`)
        out.info(`  next: prjct spec audit ${spec.id}`)
      }

      return { success: true, specId: spec.id, title: spec.title, status: spec.status }
    } catch (error) {
      return failHard(getErrorMessage(error))
    }
  }

  async list(
    _arg: string | null = null,
    projectPath: string = process.cwd(),
    options: SpecCmdOptions = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const status = options.status
      if (status && !(SPEC_STATUSES as readonly string[]).includes(status)) {
        return failWith(`unknown status: ${status} (valid: ${SPEC_STATUSES.join(', ')})`)
      }

      const specs = await specService.list(projectPath, {
        status: status as SpecStatus | undefined,
      })

      if (options.md) {
        if (specs.length === 0) {
          console.log('# Specs\n\n_No specs yet. Start one with `prjct spec "<title>"`._')
        } else {
          console.log('# Specs')
          for (const s of specs) {
            const ac = s.content.acceptance_criteria.length
            const tasks = s.content.linked_tasks.length
            console.log(
              `\n## ${s.title}\n- id: \`${s.id}\`\n- status: ${s.status}\n- acceptance criteria: ${ac}\n- linked tasks: ${tasks}\n- created: ${s.createdAt}`
            )
          }
        }
      } else {
        if (specs.length === 0) {
          out.info('no specs yet — `prjct spec "<title>"` to start one')
        } else {
          for (const s of specs) {
            const ac = s.content.acceptance_criteria.length
            console.log(`  ${s.status.padEnd(12)} ${s.id.slice(0, 8)}  ${s.title}  (${ac} AC)`)
          }
        }
      }

      return { success: true, count: specs.length }
    } catch (error) {
      return failHard(getErrorMessage(error))
    }
  }

  async show(
    id: string | null = null,
    projectPath: string = process.cwd(),
    options: SpecCmdOptions = {}
  ): Promise<CommandResult> {
    try {
      if (!id) return failWith('Usage: prjct spec show <id>')
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const spec = await specService.get(projectPath, id)
      if (!spec) return failWith(`spec not found: ${id}`)

      if (options.md) {
        console.log(renderSpecMarkdown(spec))
      } else {
        console.log(`# ${spec.title}`)
        console.log(`status: ${spec.status}`)
        console.log(`goal: ${spec.content.goal}`)
        if (spec.content.eli10) console.log(`eli10: ${spec.content.eli10}`)
        if (spec.content.acceptance_criteria.length > 0) {
          console.log('\nacceptance criteria:')
          for (const c of spec.content.acceptance_criteria) console.log(`  - ${c}`)
        }
        if (spec.content.scope.length > 0) {
          console.log('\nscope:')
          for (const c of spec.content.scope) console.log(`  - ${c}`)
        }
        if (spec.content.out_of_scope.length > 0) {
          console.log('\nout of scope:')
          for (const c of spec.content.out_of_scope) console.log(`  - ${c}`)
        }
        if (spec.content.risks.length > 0) {
          console.log('\nrisks:')
          for (const r of spec.content.risks) console.log(`  - ${r.risk} → ${r.mitigation}`)
        }
        if (spec.content.test_plan.length > 0) {
          console.log('\ntest plan:')
          for (const c of spec.content.test_plan) console.log(`  - ${c}`)
        }
      }

      return { success: true, spec }
    } catch (error) {
      return failHard(getErrorMessage(error))
    }
  }

  /**
   * PATCH the spec content. Pass any subset of fields as JSON via --json;
   * fields you omit are PRESERVED from the existing spec, fields you
   * include REPLACE the existing value (shallow merge at top level).
   *
   * This avoids the wipe footgun where a partial payload (e.g. updating
   * just the goal) would silently zero out reviews / acceptance_criteria
   * / linked_tasks because their schema defaults are empty. PATCH-style
   * semantics match user expectation and dogfood reality — when Claude
   * iterates on a spec mid-audit, it shouldn't have to re-send every
   * field to keep the rest intact.
   */
  async update(
    id: string | null = null,
    projectPath: string = process.cwd(),
    options: SpecCmdOptions = {}
  ): Promise<CommandResult> {
    try {
      if (!id) return failWith('Usage: prjct spec update <id> --json \'{"goal": "...", ...}\'')
      const jsonInput = typeof options.json === 'string' ? options.json : ''
      if (!jsonInput) return failWith('--json is required')

      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      let patch: unknown
      try {
        patch = JSON.parse(jsonInput)
      } catch {
        return failWith('--json is not valid JSON')
      }
      if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
        return failWith('--json must decode to an object')
      }

      const existing = await specService.get(projectPath, id)
      if (!existing) return failWith(`spec not found: ${id}`)

      const merged: SpecContent = SpecContentSchema.parse({
        ...existing.content,
        ...(patch as Record<string, unknown>),
      })
      const updated = await specService.update(projectPath, id, merged)
      if (!updated) return failWith(`spec not found: ${id}`)

      if (options.md) console.log(`✓ spec updated: ${updated.title}`)
      else out.done(`spec updated: ${updated.title}`)
      return { success: true, specId: updated.id }
    } catch (error) {
      return failHard(getErrorMessage(error))
    }
  }

  async setStatus(
    id: string | null = null,
    projectPath: string = process.cwd(),
    options: SpecCmdOptions = {}
  ): Promise<CommandResult> {
    try {
      if (!id) return failWith('Usage: prjct spec set-status <id> <status>')
      const status = options.status
      if (!status || !(SPEC_STATUSES as readonly string[]).includes(status)) {
        return failWith(`status must be one of: ${SPEC_STATUSES.join(', ')}`)
      }

      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const next = await specService.setStatus(projectPath, id, status as SpecStatus)
      if (!next) return failWith(`spec not found: ${id}`)

      if (options.md) console.log(`✓ spec ${id} → ${status}`)
      else out.done(`spec status: ${status}`)
      return { success: true, specId: id, status }
    } catch (error) {
      return failHard(getErrorMessage(error))
    }
  }

  /**
   * Record a single reviewer's verdict from `audit-spec`. Claude calls
   * this after each subagent returns. When all three reviewers pass, the
   * service auto-promotes the spec from `draft` → `reviewed`.
   */
  async recordReview(
    id: string | null = null,
    projectPath: string = process.cwd(),
    options: SpecCmdOptions & { reviewer?: string; verdict?: string } = {}
  ): Promise<CommandResult> {
    try {
      if (!id) {
        return failWith(
          'Usage: prjct spec record-review <id> --reviewer <strategic|architecture|design> --verdict <pass|fail> --notes "..."'
        )
      }
      const reviewer = options.reviewer
      const verdict = options.verdict
      if (!reviewer || !(SPEC_REVIEWERS as readonly string[]).includes(reviewer)) {
        return failWith(`--reviewer must be one of: ${SPEC_REVIEWERS.join(', ')}`)
      }
      if (verdict !== 'pass' && verdict !== 'fail') {
        return failWith('--verdict must be `pass` or `fail`')
      }

      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const updated = await specService.recordReview(projectPath, id, reviewer as SpecReviewer, {
        verdict,
        notes: options.notes ?? '',
      })
      if (!updated) return failWith(`spec not found: ${id}`)

      const msg = `${reviewer} → ${verdict}${updated.status === 'reviewed' ? ' (all reviewers passed → status: reviewed)' : ''}`
      if (options.md) console.log(`✓ ${msg}`)
      else out.done(msg)
      return { success: true, specId: id, status: updated.status }
    } catch (error) {
      return failHard(getErrorMessage(error))
    }
  }

  async linkTask(
    id: string | null = null,
    projectPath: string = process.cwd(),
    options: SpecCmdOptions & { taskId?: string } = {}
  ): Promise<CommandResult> {
    try {
      if (!id || !options.taskId) {
        return failWith('Usage: prjct spec link-task <spec-id> --task-id <id>')
      }
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const updated = await specService.linkTask(projectPath, id, options.taskId)
      if (!updated) return failWith(`spec not found: ${id}`)

      if (options.md) console.log(`✓ linked task ${options.taskId} to spec ${id}`)
      else out.done(`linked task → spec`)
      return { success: true, specId: id, taskId: options.taskId }
    } catch (error) {
      return failHard(getErrorMessage(error))
    }
  }

  async ship(
    id: string | null = null,
    projectPath: string = process.cwd(),
    options: SpecCmdOptions = {}
  ): Promise<CommandResult> {
    try {
      if (!id) return failWith('Usage: prjct spec ship <id> [--pr <number>]')
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const pr = options.pr !== undefined ? Number(options.pr) : undefined
      const next = await specService.ship(
        projectPath,
        id,
        pr !== undefined && Number.isFinite(pr) ? pr : undefined
      )
      if (!next) return failWith(`spec not found: ${id}`)

      if (options.md) console.log(`✓ spec shipped: ${next.title}${pr ? ` (PR #${pr})` : ''}`)
      else out.done(`spec shipped${pr ? ` (PR #${pr})` : ''}`)
      return { success: true, specId: id, status: 'shipped' }
    } catch (error) {
      return failHard(getErrorMessage(error))
    }
  }

  /**
   * Emits the dispatch prompt for Claude to run three review subagents
   * in parallel via the Agent tool. Claude reads this output, dispatches,
   * then writes each verdict back via `prjct spec record-review`.
   *
   * No subagent dispatch happens HERE — the CLI doesn't have an LLM. The
   * dispatch lives in Claude's tool use, exactly like the existing
   * `audit` workflow in the skill body.
   */
  async audit(
    id: string | null = null,
    projectPath: string = process.cwd(),
    _options: SpecCmdOptions = {}
  ): Promise<CommandResult> {
    try {
      if (!id) return failWith('Usage: prjct spec audit <id>')
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const spec = await specService.get(projectPath, id)
      if (!spec) return failWith(`spec not found: ${id}`)

      const dispatch = renderAuditDispatch(spec.id, spec.title, spec.content)
      console.log(dispatch)
      return { success: true, specId: id, dispatch: 'emitted' }
    } catch (error) {
      return failHard(getErrorMessage(error))
    }
  }

  /**
   * `prjct spec inventory [--md|--json]` — coverage map per module +
   * drift detection over shipped specs (Phase 1.6 / B-INV).
   *
   * Drift definition: shipped specs whose scope[] paths accumulated
   * >5 LOC of NON-cosmetic changes between shipped_sha and HEAD.
   * Shipped specs without shipped_sha (legacy) report drift=unknown.
   */
  async inventory(
    _arg: string | null = null,
    projectPath: string = process.cwd(),
    options: SpecCmdOptions = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const { default: configManager } = await import('../infrastructure/config-manager')
      const cfg = await configManager.readConfig(projectPath)
      const projectId = cfg?.projectId
      if (!projectId) return failWith('not a prjct project')

      const { buildInventory, renderInventoryMd } = await import('../services/spec-inventory')
      const report = await buildInventory(projectPath, projectId)

      if (options.json) {
        console.log(JSON.stringify(report, null, 2))
      } else if (options.md) {
        console.log(renderInventoryMd(report))
      } else {
        // Compact human-readable summary (no flag).
        out.info(`${report.totalSpecs} specs across ${report.modules.length} modules`)
        for (const m of report.modules) {
          const pct = m.coveredPct === null ? 'n/a' : `${m.coveredPct}%`
          const drift = m.drift === true ? ' DRIFT' : m.drift === 'unknown' ? ' ?' : ''
          console.log(
            `  ${m.module.padEnd(20)} ${String(m.specCount).padStart(3)} specs · ${pct.padStart(6)} covered${drift}`
          )
        }
        if (report.uncoveredModules.length > 0) {
          out.info(`${report.uncoveredModules.length} module(s) without specs`)
        }
      }
      return { success: true, totalSpecs: report.totalSpecs }
    } catch (error) {
      return failHard(getErrorMessage(error))
    }
  }
}

function parseFlagTags(raw: string | undefined): Record<string, string> {
  if (!raw) return {}
  const tags: Record<string, string> = {}
  for (const token of raw.split(',')) {
    const pair = token.trim()
    const idx = pair.indexOf(':')
    if (idx > 0) tags[pair.slice(0, idx)] = pair.slice(idx + 1)
  }
  return tags
}

function renderSpecMarkdown(spec: {
  id: string
  title: string
  status: string
  content: SpecContent
  createdAt: string
  updatedAt: string
}): string {
  const c = spec.content
  const lines = [
    `# ${spec.title}`,
    '',
    `**id:** \`${spec.id}\` · **status:** ${spec.status} · **created:** ${spec.createdAt}`,
    '',
    '## Goal',
    c.goal,
  ]
  if (c.eli10) lines.push('', '## ELI10', c.eli10)
  if (c.stakes) lines.push('', '## Stakes', c.stakes)
  if (c.acceptance_criteria.length > 0) {
    lines.push('', '## Acceptance criteria')
    for (const ac of c.acceptance_criteria) lines.push(`- [ ] ${ac}`)
  }
  if (c.scope.length > 0) {
    lines.push('', '## Scope')
    for (const s of c.scope) lines.push(`- ${s}`)
  }
  if (c.out_of_scope.length > 0) {
    lines.push('', '## Out of scope')
    for (const s of c.out_of_scope) lines.push(`- ${s}`)
  }
  if (c.risks.length > 0) {
    lines.push('', '## Risks')
    for (const r of c.risks) lines.push(`- **${r.risk}** — ${r.mitigation}`)
  }
  if (c.test_plan.length > 0) {
    lines.push('', '## Test plan')
    for (const t of c.test_plan) lines.push(`- ${t}`)
  }
  if (c.reviews) {
    lines.push('', '## Reviews')
    for (const reviewer of SPEC_REVIEWERS) {
      const r = c.reviews[reviewer]
      if (r) lines.push(`- **${reviewer}:** ${r.verdict} — ${r.notes} _(${r.ts})_`)
    }
  }
  if (c.linked_tasks.length > 0) {
    lines.push('', '## Linked tasks', ...c.linked_tasks.map((t) => `- ${t}`))
  }
  if (c.notes) lines.push('', '## Notes', c.notes)
  return lines.join('\n')
}

/**
 * The dispatch prompt emitted by `prjct spec audit`. Claude reads this,
 * runs three Agent calls in PARALLEL (one tool-use block per reviewer,
 * all in the same message), then writes each verdict back via
 * `prjct spec record-review`.
 */
function renderAuditDispatch(id: string, title: string, content: SpecContent): string {
  const summary = JSON.stringify(content)
  // Phase 1.6 / B-RVW: extract scope paths so each reviewer can read
  // the actual codebase via the Read tool instead of judging the spec
  // in isolation.
  const scopePaths = extractScopePaths(content.scope)
  const scopeBlock =
    scopePaths.length > 0
      ? `\n\n## Codebase paths to read (from spec.scope)\n${scopePaths.map((p) => `- \`${p}\``).join('\n')}\n\nEach reviewer SHOULD use the Read tool on these paths (cap 10 per reviewer) to ground the verdict in the actual code. Cite specific symbols / files / line numbers in notes when applicable.`
      : '\n\n## Codebase paths\n_No path-shaped scope entries found. Reviewers judge the spec body alone._'
  return [
    `# audit-spec dispatch — ${title}`,
    '',
    `Spec id: \`${id}\``,
    '',
    'Run three review subagents IN PARALLEL via the Agent tool — one tool-use block per reviewer, all in the SAME message so they run concurrently. Each subagent reads the spec body, reads the relevant codebase paths, applies its rubric, then returns a structured verdict.',
    scopeBlock,
    '',
    '## Reviewer A — strategic (scope sanity)',
    'Subagent prompt: "Review this spec for strategic soundness. Does it solve a real problem? Is the goal worth the cost? Is out_of_scope coherent with goal? Is the spec OVER- or UNDER-scoped? Cross-reference relevant prior memory if available (decisions tagged by domain). Return verdict (pass|fail) and 2-4 sentence notes."',
    '',
    '## Reviewer B — architecture (eng feasibility)',
    'Subagent prompt: "Review this spec for engineering feasibility. Read the codebase paths listed above (Read tool, cap 10 files). Can this be built ON TOP of what exists? Does the spec contradict an existing state machine, schema, or contract? What failure modes / dependencies / edge cases are missing? Include a short ASCII diagram + cite at least one concrete symbol from the codebase in notes when applicable. Return verdict (pass|fail) and 2-4 sentence notes."',
    '',
    '## Reviewer C — design (UX/DX)',
    'Subagent prompt: "Review this spec for design quality. Rate 0-10 across {clarity, ergonomics, consistency, accessibility} for the user-facing or developer-facing surface. If scope touches existing UI/CLI patterns (read the listed paths), consistency must be judged against those — not against your priors. Return verdict (pass if all dimensions ≥6, fail otherwise) + the four scores."',
    '',
    '## Spec body (verbatim, pass to each reviewer)',
    '```json',
    summary,
    '```',
    '',
    '## After dispatch',
    'For each reviewer that returns:',
    `  prjct spec record-review ${id} --reviewer <strategic|architecture|design> --verdict <pass|fail> --notes "<their notes>"`,
    '',
    'When all three are recorded, the spec auto-promotes from `draft` → `reviewed`.',
  ].join('\n')
}

/**
 * Pull file/dir paths from spec.scope entries (entries are typically
 * "core/sync/sync-manager.ts — desc" — peel off the path-like prefix).
 * Cap to 12 to stay within reviewer-tool budgets.
 */
function extractScopePaths(scope: string[]): string[] {
  const out: string[] = []
  for (const entry of scope) {
    const m = entry.match(/[a-zA-Z0-9_./-]+\.[a-zA-Z]+/) ?? entry.match(/[a-zA-Z0-9_./-]+\//)
    if (m && !out.includes(m[0])) out.push(m[0])
    if (out.length >= 12) break
  }
  return out
}
