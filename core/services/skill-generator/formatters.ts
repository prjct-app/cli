/**
 * Rich-context formatters used by the prjct skill body.
 *
 * Each function turns one slice of `SkillContext` into a markdown
 * fragment, returning '' when the data is absent so the composer can
 * filter on truthiness.
 */

import type { ProjectCommands } from '../../types/project-sync'
import type { SkillContext } from './types'

/**
 * L0 skill header — **portable only**. Project identity must never enter
 * the global skill (multi-project last-writer poison). Live name/stack/branch
 * come from SessionStart (L1) and `prjct context --md`.
 *
 * When ctx.projectName is set (legacy callers / L1 helpers), still formats
 * a header — but skill install always passes emptySkillContext().
 */
export function formatProjectHeader(ctx: SkillContext): string {
  if (!ctx.projectName) {
    // Keep lean (L0 ≤900 tok). Identity lives in SessionStart + `prjct context --md`.
    return 'Portable L0 — no project stamp. Identity is cwd-scoped (SessionStart / `prjct context --md`). Uninitialized tree: suggest `prjct init` once, then run the verb.'
  }
  return `# ${ctx.projectName}
${ctx.stack} | ${ctx.fileCount} files | v${ctx.version} | Branch: ${ctx.branch}`
}

/** Caps for always-on skill context (pull the rest). */
const ALWAYS_ON_PATTERN_CAP = 2
const ALWAYS_ON_ANTI_CAP = 2
const ALWAYS_ON_GOTCHA_CAP = 2
const ALWAYS_ON_SHIPPED_CAP = 2

export function formatPatterns(ctx: SkillContext): string {
  if (ctx.patterns.length === 0) return ''
  const items = ctx.patterns
    .slice(0, ALWAYS_ON_PATTERN_CAP)
    .map((p) => `- **${p.name}**: ${p.description}${p.location ? ` (${p.location})` : ''}`)
    .join('\n')
  return `\n## Patterns\n${items}\n`
}

export function formatAntiPatterns(ctx: SkillContext): string {
  if (ctx.antiPatterns.length === 0) return ''
  const severityIcon: Record<string, string> = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' }
  const items = ctx.antiPatterns
    .slice(0, ALWAYS_ON_ANTI_CAP)
    .map(
      (a) =>
        `- ${severityIcon[a.severity] || 'MEDIUM'}: ${a.issue} in \`${a.file}\` — ${a.suggestion}`
    )
    .join('\n')
  return `\n## Anti-Patterns\n${items}\n`
}

export function formatGotchas(ctx: SkillContext): string {
  if (ctx.knownGotchas.length === 0) return ''
  const items = ctx.knownGotchas
    .slice(0, ALWAYS_ON_GOTCHA_CAP)
    .map((g) => `- ${g}`)
    .join('\n')
  return `\n## Known Gotchas\n${items}\n`
}

export function formatRecentShipped(ctx: SkillContext): string {
  if (ctx.recentShipped.length === 0) return ''
  const items = ctx.recentShipped
    .slice(0, ALWAYS_ON_SHIPPED_CAP)
    .map((s) => {
      const parts = [`"${s.name}"`, s.type]
      if (s.duration) parts.push(s.duration)
      if (s.filesChanged) parts.push(`${s.filesChanged} files`)
      return `- ${parts.join(' — ')}`
    })
    .join('\n')
  return `\n## Recent Deliveries\n${items}\n`
}

export function formatVelocity(ctx: SkillContext): string {
  if (!ctx.velocity) return ''
  const parts: string[] = []
  if (ctx.velocity.avgPoints != null) parts.push(`${ctx.velocity.avgPoints} pts/sprint`)
  if (ctx.velocity.trend) parts.push(ctx.velocity.trend)
  if (ctx.velocity.accuracy != null) parts.push(`Estimation accuracy: ${ctx.velocity.accuracy}%`)
  if (parts.length === 0) return ''
  return `\n## Velocity\n${parts.join(' | ')}\n`
}

export function formatCommands(commands: ProjectCommands): string {
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

export function formatState(ctx: SkillContext): string {
  // Counts only. Task DESCRIPTIONS are stale by the next sync, and the
  // per-turn prompt hook already injects the LIVE active task — baking
  // text snippets into a body that sits in context every turn burned
  // tokens on duplicated, aging data. Pull the detail on demand:
  // `prjct context --md`.
  const parts: string[] = []
  if (ctx.pausedTasks.length > 0) parts.push(`Paused: ${ctx.pausedTasks.length}`)
  if (ctx.backlogCount > 0) parts.push(`Backlog: ${ctx.backlogCount}`)
  if (ctx.ideasCount > 0) parts.push(`Ideas: ${ctx.ideasCount} pending`)
  if (ctx.shippedCount > 0) parts.push(`Shipped: ${ctx.shippedCount}`)

  if (parts.length === 0) return ''
  return `\n## State\n${parts.join(' | ')} — detail via \`prjct context --md\`\n`
}

export function formatUserPatterns(ctx: SkillContext): string {
  if (ctx.userPatterns.length === 0) return ''
  const items = ctx.userPatterns
    .slice(0, 3)
    .map((p) => `- ${p}`)
    .join('\n')
  return `\n## User Patterns\n${items}\n`
}

export function formatRichContext(ctx: SkillContext): string {
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
