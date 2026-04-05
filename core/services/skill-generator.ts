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

const SKILL_DEFINITIONS: SkillDefinition[] = [
  // ── Non-invocable context ──────────────────────────────────────────────
  {
    name: 'prjct-context',
    description: 'Project context with state and user patterns',
    allowedTools: [],
    userInvocable: false,
    condition: () => true,
    body: (ctx) => `${formatProjectHeader(ctx)}
${formatRichContext(ctx)}`,
  },

  // ── Core Workflow — State machine ─────────────────────────────────────
  {
    name: 'prjct-task',
    description: 'Start a task with full project context',
    allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Task', 'AskUserQuestion'],
    condition: () => true,
    body: (_ctx) => `## Workflow

### Register Task
\`\`\`bash
prjct task "$ARGUMENTS" --md
\`\`\`
Read the Context Contract from CLI output — it has file paths, subtasks, and scope.
If CLI output is JSON with \`options\`, present choices to user.

### Execute
- Create feature branch if on main: \`git checkout -b {type}/{slug}\`
- Work through subtasks; mark each done: \`prjct done --md\`
### Ship
When complete: \`p. ship\` or \`prjct ship --md\`
`,
  },
  {
    name: 'prjct-done',
    description:
      'Marks the current task as complete and feeds the feedback loop. Use when the user says "done", "finished", "ship it", or wants to complete current work. Completion data flows to sync → skill regeneration.',
    allowedTools: ['Bash', 'AskUserQuestion'],
    condition: () => true,
    body: (ctx) => {
      const lines = ['## Workflow']
      if (ctx.hasActiveTask) {
        lines.push(`\nActive task: **${ctx.activeTaskDescription}**`)
      }
      lines.push(`
\`\`\`bash
prjct done "$ARGUMENTS" --md
\`\`\`
Read CLI output for completion summary and next steps.
`)
      return lines.join('\n')
    },
  },
  {
    name: 'prjct-ship',
    description:
      'Ship feature: PR, version bump, changelog. Auto-completes active task if one exists before shipping.',
    allowedTools: ['Bash', 'Read', 'AskUserQuestion'],
    condition: () => true,
    body: (_ctx) => `## Workflow

### Pre-flight (BLOCKING)
1. Verify NOT on main/master: \`git branch --show-current\`
2. Verify GitHub auth: \`gh auth status\`

### Ship
\`\`\`bash
prjct ship "$ARGUMENTS" --md
\`\`\`
Review what will be committed, versioned, and PR'd.
ASK: "Ready to ship?" Yes / No / Show diff

### Finalize
- Commit with prjct footer: \`Generated with [p/](https://www.prjct.app/)\`
- Push and create PR
- Update issue tracker if linked
`,
  },
  {
    name: 'prjct-pause',
    description:
      'Pauses the active task to handle an interruption. Use when the user needs to switch context, handle something urgent, or stop current work temporarily.',
    allowedTools: ['Bash', 'AskUserQuestion'],
    condition: () => true,
    body: (ctx) => {
      const lines = ['## Workflow']
      if (ctx.hasActiveTask) {
        lines.push(`\nActive task: **${ctx.activeTaskDescription}**`)
      }
      lines.push(`
\`\`\`bash
prjct pause "$ARGUMENTS" --md
\`\`\`
Read CLI output for pause confirmation and context saved.
`)
      return lines.join('\n')
    },
  },
  {
    name: 'prjct-resume',
    description:
      'Resumes a paused task. Use when the user says "resume", "continue", "pick up where I left off", or wants to return to previous work.',
    allowedTools: ['Bash', 'Read', 'AskUserQuestion'],
    condition: () => true,
    body: (ctx) => {
      const lines = ['## Workflow']
      if (ctx.pausedTasks.length > 0) {
        lines.push('\n### Paused Tasks')
        for (const t of ctx.pausedTasks.slice(0, 5)) {
          lines.push(`- **${t.description}** (paused ${t.pausedAt})`)
        }
      }
      lines.push(`
\`\`\`bash
prjct resume "$ARGUMENTS" --md
\`\`\`
Read CLI output for restored context and next steps.
`)
      return lines.join('\n')
    },
  },
  {
    name: 'prjct-next',
    description:
      'Shows the priority queue and recommends what to work on next. Use when the user asks "what should I do?", "what\'s next?", or is between tasks.',
    allowedTools: ['Bash', 'AskUserQuestion'],
    condition: () => true,
    body: (ctx) => {
      const lines = ['## Workflow']
      if (ctx.backlogCount > 0) {
        lines.push(`\n${ctx.backlogCount} items in backlog.`)
        if (ctx.topBacklog.length > 0) {
          lines.push('Top priorities:')
          for (const t of ctx.topBacklog) {
            lines.push(`- [${t.priority}] ${t.description}`)
          }
        }
      }
      lines.push(`
\`\`\`bash
prjct next --md
\`\`\`
Present the prioritized list and help user pick a task.
`)
      return lines.join('\n')
    },
  },
  {
    name: 'prjct-sync',
    description: 'Re-analyze project and regenerate context',
    allowedTools: ['Bash', 'AskUserQuestion'],
    condition: () => true,
    body: (_ctx) => `## Workflow

\`\`\`bash
prjct sync $ARGUMENTS --md
\`\`\`
Read CLI output for analysis results.
Present results: tables, analysis findings, anti-patterns, conventions.

## What sync does
- Git analysis (branch, changes, recent commits)
- Project stats (files, stack, frameworks)
- Skill regeneration (this skill and others)
- Index building (BM25, import graph, co-change)
- Pattern extraction and analysis

## Obsidian Integration
After completing analysis, check if Obsidian is configured:
\`\`\`bash
prjct obsidian status --md
\`\`\`
If configured, write project insights to the vault using the MCP tool \`prjct_obsidian_write\`:
- notePath: \`_insights.md\`
- frontmatter: \`{ prjct_type: "insights", updated: "YYYY-MM-DD" }\`
- content: Your analysis written in natural language (NOT tables or templates)

Write like a PM briefing the team. Include:
- Project status: active task, queue depth, blockers, what needs attention
- Architecture: style, key patterns, domains identified
- Recent progress: last deliveries with their impact
- Risks: anti-patterns found, tech debt, areas of concern
- Decisions: key technical choices and rationale
- Velocity: trend, estimation accuracy, capacity
- Next priorities: what should be tackled next and why

Be specific — cite issue IDs, file paths, concrete numbers. Skip this step if Obsidian is not configured.
`,
  },
  {
    name: 'prjct-bug',
    description: 'Report and track a bug with auto-priority',
    allowedTools: ['Bash', 'Task', 'AskUserQuestion'],
    condition: () => true,
    body: (_ctx) => `## Workflow

1. If no description provided, ASK the user for details
2. Run \`prjct bug "$ARGUMENTS" --md\`
3. Search the codebase for affected files
4. ASK: "Fix this bug now?" Fix now / Queue for later
5. If fix now: create branch \`bug/{slug}\` and start working
6. If queue: done — bug is tracked
`,
  },
  {
    name: 'prjct-workflow',
    description:
      'Configures workflow gates, hooks, steps, and instructions via natural language (English/Spanish). Use when the user wants to customize the task→done→ship cycle with before/after hooks, quality gates, or custom steps.',
    allowedTools: ['Bash', 'AskUserQuestion'],
    condition: () => true,
    body: (_ctx) => `## Workflow

\`\`\`bash
prjct workflow "$ARGUMENTS" --md
\`\`\`
Read CLI output for hook configuration results.

Supports natural language in English and Spanish:
- "before ship, run tests"
- "antes de ship, correr tests"
- Gates: block transitions until conditions are met
- Hooks: run commands before/after state transitions
- Steps: add custom workflow stages
`,
  },

  // ── Integrations — Enrichment pipeline ────────────────────────────────
  {
    name: 'prjct-enrich',
    description:
      'Finds relevant files for issues by analyzing local code. Input to linear/jira sync pipeline.',
    allowedTools: ['Bash', 'Read', 'Grep', 'Glob', 'AskUserQuestion'],
    condition: () => true,
    body: (_ctx) => `## Workflow

\`\`\`bash
prjct enrich "$ARGUMENTS" --md
\`\`\`
Read CLI output for enrichment data.
`,
  },
  {
    name: 'prjct-linear',
    description:
      'Linear integration — sync issues, create/update tasks, manage projects. Use when the user mentions Linear, wants to sync issues, or manage work items in Linear.',
    allowedTools: ['Bash', 'AskUserQuestion'],
    condition: () => true,
    body: (_ctx) => `## Workflow

\`\`\`bash
prjct linear "$ARGUMENTS" --md
\`\`\`
Read CLI output for Linear sync results.
`,
  },
  {
    name: 'prjct-jira',
    description:
      'Jira integration — sync issues, transitions, boards. Use when the user mentions Jira, wants to sync tickets, or manage work in Jira.',
    allowedTools: ['Bash', 'AskUserQuestion'],
    condition: () => true,
    body: (_ctx) => `## Workflow

\`\`\`bash
prjct jira "$ARGUMENTS" --md
\`\`\`
Read CLI output for Jira sync results.
`,
  },

  // ── Conditional: Metrics ───────────────────────────────────────────────
  {
    name: 'prjct-plan',
    description: 'Plan work with real velocity and backlog',
    allowedTools: ['Bash', 'Read', 'AskUserQuestion'],
    condition: (ctx) => ctx.backlogCount > 0,
    body: (_ctx) => `## Workflow

1. Run \`prjct next --md\` to see prioritized backlog
2. Review velocity data: \`prjct dash --md\`
3. Discuss priorities with the user
4. Start chosen task: \`p. task "description"\`
`,
  },
  {
    name: 'prjct-velocity',
    description: 'Show delivery velocity and metrics',
    allowedTools: ['Bash', 'Read'],
    condition: (ctx) => ctx.completedTaskCount >= 5,
    body: (_ctx) => `## Workflow

1. Run \`prjct dash --md\` for full metrics dashboard
2. Present velocity, estimation accuracy, and burndown
3. Highlight trends: improving, stable, or declining

## Metrics Available
- Tasks completed per week
- Average task duration
- Points delivered vs estimated
- Shipping frequency
`,
  },

  // ── Token Tracking ──────────────────────────────────────────────────────
  {
    name: 'prjct-tokens',
    description:
      'Record token usage on the active task. Auto-invoke BEFORE completing a task (done/ship) to track input/output tokens for cost analysis.',
    allowedTools: ['Bash'],
    condition: () => true,
    body: (_ctx) => `## Workflow

Report your token usage on the active task:

\`\`\`bash
prjct tokens <input_tokens> <output_tokens>
\`\`\`

**IMPORTANT**: Call this BEFORE \`prjct done\` or \`prjct ship\` so token usage is persisted to task history.

Tokens accumulate — call multiple times during a task and they add up.
Token totals are saved to task history on completion for cost comparison across tasks.
`,
  },
]

// ============================================================================
// HELPERS
// ============================================================================

function buildFrontmatter(skill: SkillDefinition, ctx: SkillContext): string {
  const isUserInvocable = skill.userInvocable !== false
  return `---
description: "${skill.description} (${ctx.projectName}, ${ctx.stack})"
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
