/**
 * Skill Generator — Auto-generates Native Claude Code Skills from sync results.
 *
 * During `prjct sync`, generates workflow SKILL.md files installed to ~/.claude/skills/.
 * These are project-management skills with RICH project context baked in:
 * - Real patterns, anti-patterns, velocity, shipped features, known gotchas
 * - Embedded workflow that wraps CLI commands (heavy lifting in JS)
 *
 * Design principles:
 * - Progressive disclosure: SKILL.md is concise, `prjct <cmd> --md` for details
 * - Data real embebida: Each skill includes relevant project data inline
 * - Pushy descriptions: Say WHEN to use, not just WHAT it does
 * - Context economy: Only include what Claude doesn't know. Every token justified
 * - Rich context lives in prjct-context (non-invocable): patterns, anti-patterns,
 *   velocity, gotchas, shipped, commands — workflow skills do NOT duplicate this
 *
 * @version 3.0.0
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getErrorMessage } from '../errors'
import type { ProjectCommands, ProjectSyncResult } from '../types/project-sync'
import type { SkillGenerationResult } from '../types/services.js'
import log from '../utils/logger'

// ============================================================================
// TYPES
// ============================================================================

interface SkillContext {
  // Basics
  projectName: string
  stack: string
  branch: string
  commands: ProjectCommands
  projectId: string

  // Rich data from SQLite
  version: string
  fileCount: number
  patterns: { name: string; description: string; location?: string }[]
  antiPatterns: { issue: string; file: string; suggestion: string; severity: string }[]
  recentShipped: { name: string; type: string; duration?: string; filesChanged?: number }[]
  velocity: { avgPoints?: number; trend?: string; accuracy?: number } | null
  backlogCount: number
  completedTaskCount: number
  pausedTaskCount: number
  knownGotchas: string[]

  // Task state (from stateStorage)
  hasActiveTask: boolean
  activeTaskDescription: string
  pausedTasks: { description: string; pausedAt: string }[]
  // Backlog (top items from queueStorage)
  topBacklog: { description: string; priority: string }[]
  // Counts
  ideasCount: number
  shippedCount: number

  // User behavior patterns (from aggregated feedback)
  userPatterns: string[]
}

interface SkillDefinition {
  name: string
  description: string
  allowedTools: string[]
  /** Whether users can invoke this skill directly (default true) */
  userInvocable?: boolean
  /** Return true if the skill should be generated */
  condition: (ctx: ConditionContext) => boolean
  /** Generate the skill body content */
  body: (ctx: SkillContext) => string
}

interface ConditionContext {
  backlogCount: number
  completedTaskCount: number
  pausedTaskCount: number
  hasActiveTask: boolean
}

// ============================================================================
// RICH CONTEXT FORMATTERS
// ============================================================================

function formatProjectHeader(ctx: SkillContext): string {
  return `# ${ctx.projectName}
${ctx.stack} | ${ctx.fileCount} files | v${ctx.version} | Branch: ${ctx.branch}`
}

function formatPatterns(ctx: SkillContext): string {
  if (ctx.patterns.length === 0) return ''
  const items = ctx.patterns
    .slice(0, 6)
    .map((p) => `- **${p.name}**: ${p.description}${p.location ? ` (${p.location})` : ''}`)
    .join('\n')
  return `\n## Patterns\n${items}\n`
}

function formatAntiPatterns(ctx: SkillContext): string {
  if (ctx.antiPatterns.length === 0) return ''
  const severityIcon: Record<string, string> = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' }
  const items = ctx.antiPatterns
    .slice(0, 6)
    .map(
      (a) =>
        `- ${severityIcon[a.severity] || 'MEDIUM'}: ${a.issue} in \`${a.file}\` — ${a.suggestion}`
    )
    .join('\n')
  return `\n## Anti-Patterns\n${items}\n`
}

function formatGotchas(ctx: SkillContext): string {
  if (ctx.knownGotchas.length === 0) return ''
  const items = ctx.knownGotchas
    .slice(0, 5)
    .map((g) => `- ${g}`)
    .join('\n')
  return `\n## Known Gotchas\n${items}\n`
}

function formatRecentShipped(ctx: SkillContext): string {
  if (ctx.recentShipped.length === 0) return ''
  const items = ctx.recentShipped
    .slice(0, 5)
    .map((s) => {
      const parts = [`"${s.name}"`, s.type]
      if (s.duration) parts.push(s.duration)
      if (s.filesChanged) parts.push(`${s.filesChanged} files`)
      return `- ${parts.join(' — ')}`
    })
    .join('\n')
  return `\n## Recent Deliveries\n${items}\n`
}

function formatVelocity(ctx: SkillContext): string {
  if (!ctx.velocity) return ''
  const parts: string[] = []
  if (ctx.velocity.avgPoints != null) parts.push(`${ctx.velocity.avgPoints} pts/sprint`)
  if (ctx.velocity.trend) parts.push(ctx.velocity.trend)
  if (ctx.velocity.accuracy != null) parts.push(`Estimation accuracy: ${ctx.velocity.accuracy}%`)
  if (parts.length === 0) return ''
  return `\n## Velocity\n${parts.join(' | ')}\n`
}

function formatCommands(commands: ProjectCommands): string {
  const rows = [
    ['Build', commands.build],
    ['Test', commands.test],
    ['Lint', commands.lint],
    ['Dev', commands.dev],
    ['Format', commands.format],
  ].filter(([_, cmd]) => cmd)

  if (rows.length === 0) return ''

  return `\n## Commands
| Action | Command |
|--------|---------|
${rows.map(([action, cmd]) => `| ${action} | \`${cmd}\` |`).join('\n')}
`
}

function formatState(ctx: SkillContext): string {
  const lines: string[] = []
  if (ctx.hasActiveTask) {
    lines.push(`Active task: **${ctx.activeTaskDescription}**`)
  }
  if (ctx.pausedTasks.length > 0) {
    for (const t of ctx.pausedTasks.slice(0, 3)) {
      lines.push(`Paused: ${t.description} (${t.pausedAt})`)
    }
  }
  if (ctx.backlogCount > 0) {
    const topItems = ctx.topBacklog
      .slice(0, 3)
      .map((t) => `${t.description} [${t.priority}]`)
      .join(', ')
    lines.push(`Backlog: ${ctx.backlogCount} items${topItems ? ` — ${topItems}` : ''}`)
  }
  const extras: string[] = []
  if (ctx.ideasCount > 0) extras.push(`Ideas: ${ctx.ideasCount} pending`)
  if (ctx.shippedCount > 0) extras.push(`Shipped: ${ctx.shippedCount}`)
  if (extras.length > 0) lines.push(extras.join(' | '))

  if (lines.length === 0) return ''
  return `\n## State\n${lines.join('\n')}\n`
}

function formatUserPatterns(ctx: SkillContext): string {
  if (ctx.userPatterns.length === 0) return ''
  const items = ctx.userPatterns
    .slice(0, 8)
    .map((p) => `- ${p}`)
    .join('\n')
  return `\n## User Patterns\n${items}\n`
}

function formatRichContext(ctx: SkillContext): string {
  return [
    formatPatterns(ctx),
    formatAntiPatterns(ctx),
    formatGotchas(ctx),
    formatRecentShipped(ctx),
    formatVelocity(ctx),
    formatCommands(ctx.commands),
    formatState(ctx),
    formatUserPatterns(ctx),
  ]
    .filter(Boolean)
    .join('')
}

// ============================================================================
// SKILL DEFINITIONS
// ============================================================================

/**
 * Anti-harness skill template (canonical Anthropic shape).
 *
 * The body is `Use when` + `What's here` + `Gotchas` — zero numbered
 * steps, zero "first X then Y", zero "pre-flight BLOCKING" language.
 * prjct describes state; Claude decides CÓMO.
 *
 * Rich project data (persona, active task, recent shipped, patterns,
 * …) is injected by `formatRichContext(ctx)` so the single skill
 * still carries project-specific signal without being prescriptive.
 */
const SKILL_DEFINITIONS: SkillDefinition[] = [
  {
    name: 'prjct',
    description:
      'Project memory + quality workflows. Use to recall prior decisions/learnings/gotchas, run quality reviews (review, qa, security, investigate), ship safely, or capture insights. Lookup-first: check the vault before re-reading source.',
    allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Task'],
    condition: () => true,
    body: (ctx) => buildPrjctSkillBody(ctx),
  },
]

function buildPrjctSkillBody(ctx: SkillContext): string {
  return [
    '# prjct',
    '',
    `## Use when`,
    '',
    'You want to:',
    '- recall prior project decisions, learnings, or shipped features',
    '- capture a thought, todo, or insight without a commitment',
    '- run a workflow the project already registered',
    '- understand your role and the MCPs available in this project',
    '',
    "## What's here",
    '',
    formatProjectHeader(ctx),
    '',
    formatRichContext(ctx),
    '',
    '### Primitives',
    '',
    '- `prjct capture "<anything>"` — inbox dump (zero ceremony)',
    '- `prjct remember <type> "<content>" [--tags]` — typed memory entry',
    '- `prjct context memory [topic]` — recall with optional keyword filter',
    '- `prjct workflow list` / `prjct workflow run <name>` — registered workflows',
    '- `prjct seed list` — active packs (memory types + workflow slots)',
    '',
    'Base memory types: `fact · decision · learning · gotcha · pattern · anti-pattern · shipped · inbox · todo · idea · insight · question · source · person`. Any lowercase string works (e.g. `recipe`, `okr`, `stakeholder`).',
    '',
    '### Data paths',
    '',
    '- `.prjct/wiki/_generated/` — agent-crawlable markdown (regenerated on ship/remember)',
    '- `.prjct/wiki/captured/` — drop notes with frontmatter, run `prjct context wiki sync` to ingest',
    '- `.prjct/prjct.config.json` — persona + active packs',
    '',
    '## Quality workflows',
    '',
    'Five named workflows for shipping quality. Each has an explicit methodology, modes, and stop conditions. Each persists findings via `prjct remember` so the vault accumulates project-specific knowledge across sessions.',
    '',
    '### `review` — Production Bug Hunt + Completeness Gate',
    '',
    'Use when: user asks to review code, a PR, a recent diff, or "is this ready to ship".',
    '',
    'Modes (pick one based on context):',
    '- `expansion` — adversarial scope ("what could break", "what is missing")',
    '- `polish` — final pass on already-correct code (naming, ergonomics, comments)',
    '- `triage` — fast pass that flags everything but only auto-fixes the obvious',
    '',
    'Methodology:',
    '1. Read git diff + relevant memory (decisions, gotchas) for affected files.',
    '2. Find bugs that pass CI but blow up in production: race conditions, off-by-one, error swallow, leaked resources, partial writes, retry storms.',
    '3. Auto-fix only the OBVIOUS (typos, wrong var names, missing await on a promise that is then discarded). Anything ambiguous → flag, do not touch.',
    '4. Stop conditions: max 3 auto-fixes per file (more = the file needs a human); never refactor outside the diff scope.',
    '5. Persist: `prjct remember gotcha "<bug + how to avoid>"` for each finding; `prjct remember decision "<auto-fix applied>"` for each fix.',
    '',
    '### `qa` — Real Browser, Atomic Fixes, Regression Tests',
    '',
    'Use when: user asks to test the app, validate a UI change, find UI bugs, or check accessibility.',
    '',
    'Methodology:',
    '1. Use a real browser (Playwright MCP if available; otherwise document the manual steps).',
    '2. Walk the golden path + 2-3 edge cases for the affected feature.',
    '3. For each bug: atomic commit with `fix:` prefix + a regression test that fails without the fix.',
    '4. Stop conditions: max 3 failed fixes per bug — escalate to a human with details (what was tried, why it failed).',
    '5. Persist: `prjct remember gotcha "<UI bug + reproducer>"`; `prjct remember decision "<fix + regression test path>"`.',
    '',
    '### `security` — OWASP Top 10 + STRIDE Threat Model',
    '',
    'Use when: user asks for a security review, a CSO check, a vulnerability scan, or "is this safe to ship".',
    '',
    'Methodology:',
    '1. Walk OWASP Top 10 against the diff: injection, broken auth, sensitive data exposure, XXE, broken access control, security misconfig, XSS, insecure deserialization, vulnerable deps, insufficient logging.',
    '2. Run STRIDE on each new endpoint / data flow: Spoofing, Tampering, Repudiation, Info disclosure, DoS, Elevation of privilege.',
    '3. Confidence gate: only report findings rated 8/10+ on exploit feasibility AND impact. Below = note in appendix only.',
    '4. False-positive exclusions: skip CSRF on idempotent GET, skip SQL injection on parameterized queries, skip XSS on already-escaped templates, skip leaks on logged-error-codes-without-PII. (List grows with project context — capture exclusions as `prjct remember decision`).',
    '5. Each finding includes a CONCRETE exploit scenario (curl + payload, or click sequence). Abstract "could be exploited" is not actionable.',
    '6. Persist: `prjct remember gotcha "<finding + exploit + fix>"` for every 8/10+ finding.',
    '',
    '### `investigate` — Iron Law: no fix without investigation',
    '',
    'Use when: user reports a bug, behavior is unexpected, tests fail intermittently, "why does X happen".',
    '',
    'Methodology:',
    '1. Iron Law: NO code fix until you can state the root cause in one sentence.',
    '2. Trace the data flow from user input to symptom. Include logs, network, state.',
    '3. Form a hypothesis. Design a test that proves or disproves it.',
    '4. Stop condition: max 3 failed hypotheses per bug — escalate with what was tried.',
    '5. Auto-freeze: limit edits to the module under investigation (mention this constraint to the user).',
    '6. Persist: `prjct remember learning "<root cause discovered>"`; `prjct remember decision "<fix + why it works>"`; `prjct remember gotcha "<related bug surfaced during investigation>"`.',
    '',
    '### `ship` (endurecido) — Coverage Gate + Auto-Document',
    '',
    'Use when: user asks to ship, deploy, merge, or finalize work.',
    '',
    'Methodology (additions to the existing `prjct ship`):',
    '1. Bootstrap a test framework if the project has none (bun test / vitest / jest based on stack).',
    '2. Coverage gate: BLOCK ship if coverage drops more than 2% from the previous version.',
    '3. Auto-document: scan the diff against README / ARCHITECTURE / CHANGELOG / CLAUDE.md → propose updates for any drift.',
    '4. PR description: include {Summary, Tests added (delta), Coverage delta, Risk areas touched (cross-reference `_generated/analysis/risk-areas/`), Reviews already run on this branch}.',
    '5. Persist: `prjct remember decision "<release notes + coverage delta>"` so the next sprint sees the trend.',
    '',
    '### Outputs convention',
    '',
    'Every workflow above persists findings VIA `prjct remember <type>` — never to ad-hoc files. The wiki regen exposes them in `_generated/memory/<type>.md` and `_generated/analysis/`. Tag with `--tags workflow:<name>,task:<id>` so the user can query a sprint cleanly with `prjct context --tags task=<id>`.',
    '',
    '## Gotchas',
    '',
    '- Memory recall is best-effort — an empty result means no match, not "nothing exists".',
    '- Tags are freeform strings — reuse existing vocabulary before inventing new keys.',
    '- Secret-like content is refused by `remember` and `capture` unless `--force`.',
    '- Bare `prjct "<text>"` routes to `capture` (inbox), not `task`. Use `prjct task` explicitly for work that needs a branch/worktree.',
    '- Hooks in `~/.claude/settings.json` already inject persona + topical memory on SessionStart / UserPromptSubmit — you rarely need to call prjct by hand at session start.',
    '',
  ].join('\n')
}

// ============================================================================
// HELPERS
// ============================================================================

function buildFrontmatter(skill: SkillDefinition, ctx: SkillContext): string {
  const isUserInvocable = skill.userInvocable !== false
  // CRITICAL — cache stability: the description appears verbatim in the
  // host model's system prompt. Project-specific suffixes like
  // `(${name}, ${stack})` change every time `prjct sync` runs in a
  // different cwd, busting the entire system-prompt prefix and forcing
  // a full re-tokenization on the next turn. Keep the description
  // STATIC. Project metadata still ships in the skill body (loaded on
  // skill invocation), so Claude sees it when it actually needs it.
  void ctx
  return `---
description: "${skill.description}"
allowed-tools: [${skill.allowedTools.map((t) => `"${t}"`).join(', ')}]
user-invocable: ${isUserInvocable}
---`
}

function buildSkillContent(def: SkillDefinition, ctx: SkillContext): string {
  return `${buildFrontmatter(def, ctx)}\n\n${def.body(ctx)}`
}

// ============================================================================
// SKILL GENERATOR
// ============================================================================

class SkillGenerator {
  /**
   * Generate workflow skills from sync results and install to ~/.claude/skills/.
   */
  async generateAndInstall(
    syncResult: ProjectSyncResult,
    conditionContext: ConditionContext = {
      backlogCount: 0,
      completedTaskCount: 0,
      pausedTaskCount: 0,
      hasActiveTask: false,
    },
    richContext?: Partial<
      Omit<SkillContext, 'projectName' | 'stack' | 'branch' | 'commands' | 'projectId'>
    >
  ): Promise<SkillGenerationResult> {
    const result: SkillGenerationResult = { generated: [], skipped: [] }

    const ctx: SkillContext = {
      projectName: syncResult.stats.name,
      stack:
        [...syncResult.stats.languages, ...syncResult.stats.frameworks].filter(Boolean).join('/') ||
        syncResult.stats.ecosystem,
      branch: syncResult.git.branch,
      commands: syncResult.commands,
      projectId: syncResult.projectId,

      // Rich context with defaults
      version: richContext?.version ?? syncResult.stats.version ?? '0.0.0',
      fileCount: richContext?.fileCount ?? syncResult.stats.fileCount ?? 0,
      patterns: richContext?.patterns ?? [],
      antiPatterns: richContext?.antiPatterns ?? [],
      recentShipped: richContext?.recentShipped ?? [],
      velocity: richContext?.velocity ?? null,
      backlogCount: richContext?.backlogCount ?? conditionContext.backlogCount,
      completedTaskCount: richContext?.completedTaskCount ?? conditionContext.completedTaskCount,
      pausedTaskCount: richContext?.pausedTaskCount ?? conditionContext.pausedTaskCount,
      knownGotchas: richContext?.knownGotchas ?? [],

      // Task state
      hasActiveTask: richContext?.hasActiveTask ?? conditionContext.hasActiveTask,
      activeTaskDescription: richContext?.activeTaskDescription ?? '',
      pausedTasks: richContext?.pausedTasks ?? [],
      topBacklog: richContext?.topBacklog ?? [],
      ideasCount: richContext?.ideasCount ?? 0,
      shippedCount: richContext?.shippedCount ?? 0,
      userPatterns: richContext?.userPatterns ?? [],
    }

    const skillsDir = path.join(os.homedir(), '.claude', 'skills')

    for (const def of SKILL_DEFINITIONS) {
      if (!def.condition(conditionContext)) {
        result.skipped.push({ name: def.name, reason: 'condition not met' })
        // Clean up stale skill if it was previously generated
        await fs
          .rm(path.join(skillsDir, def.name), { recursive: true, force: true })
          .catch(() => {})
        continue
      }

      try {
        const content = buildSkillContent(def, ctx)
        const skillDir = path.join(skillsDir, def.name)
        const skillPath = path.join(skillDir, 'SKILL.md')

        await fs.mkdir(skillDir, { recursive: true })
        await fs.writeFile(skillPath, content, 'utf-8')

        result.generated.push({ name: def.name, path: skillPath })
      } catch (error) {
        log.debug(`Failed to generate skill ${def.name}`, { error: getErrorMessage(error) })
        result.skipped.push({ name: def.name, reason: getErrorMessage(error) })
      }
    }

    // Clean up stale prjct-* skill directories not in current definitions
    const knownNames = new Set(SKILL_DEFINITIONS.map((d) => d.name))
    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('prjct-') && !knownNames.has(entry.name)) {
          await fs
            .rm(path.join(skillsDir, entry.name), { recursive: true, force: true })
            .catch(() => {})
        }
      }
    } catch {
      // Non-critical — stale cleanup failure shouldn't block sync
    }

    if (result.generated.length > 0) {
      log.info('Generated native workflow skills', {
        count: result.generated.length,
        skills: result.generated.map((s) => s.name),
      })
    }

    return result
  }

  /** Get all skill definitions (for testing) */
  getDefinitions(): SkillDefinition[] {
    return SKILL_DEFINITIONS
  }
}

export const skillGenerator = new SkillGenerator()
export { SkillGenerator, SKILL_DEFINITIONS }
export type { SkillContext, SkillDefinition, ConditionContext }
