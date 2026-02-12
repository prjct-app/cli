/**
 * Markdown formatter utilities for --md flag output
 *
 * Produces rich, structured markdown optimized for Claude Code's terminal.
 * Used by all CLI commands when invoked with --md.
 *
 * Design system:
 * - Branded header/footer with ⚡ prjct
 * - H2 for primary content, H3 for sections
 * - Tables for structured data (subtasks, stats, next steps)
 * - Callouts for status messages (success/warn/error/info)
 * - Code formatting for paths and commands
 */

import { getVersion } from './version'

// =============================================================================
// Branding & Layout
// =============================================================================

/** Branded header */
export function mdHeader(): string {
  return '⚡ prjct\n\n---'
}

/** Branded footer with version */
export function mdFooter(): string {
  const version = getVersion()
  return `---\n⚡ prjct · v${version}`
}

/** Horizontal rule divider */
export function mdDivider(): string {
  return '---'
}

// =============================================================================
// Output Wrapper
// =============================================================================

/** Wrap any --md output with branded header and footer */
export function mdOutput(...sections: (string | null | undefined | false)[]): string {
  return mdJoin(mdHeader(), ...sections.filter(Boolean), mdFooter())
}

// =============================================================================
// Generic Utilities
// =============================================================================

/** Build a markdown table from headers and rows */
export function mdTable(headers: string[], rows: string[][]): string {
  const headerRow = `| ${headers.join(' | ')} |`
  const separator = `|${headers.map(() => '---').join('|')}|`
  const bodyRows = rows.map((row) => `| ${row.join(' | ')} |`)
  return [headerRow, separator, ...bodyRows].join('\n')
}

/** Format a fenced code block */
export function mdCodeBlock(code: string, lang = ''): string {
  return `\`\`\`${lang}\n${code}\n\`\`\``
}

/** Inline key-value badge */
export function mdBadge(label: string, value: string): string {
  return `**${label}**: \`${value}\``
}

/** Callout block with emoji and bold message */
export function mdCallout(type: 'success' | 'warn' | 'error' | 'info', message: string): string {
  const emoji = { success: '✅', warn: '⚠️', error: '❌', info: 'ℹ️' }[type]
  return `> ${emoji} **${message}**`
}

// =============================================================================
// Section Formatters
// =============================================================================

/** Format a section heading with content */
export function mdSection(title: string, content: string, _level: 2 | 3 = 3): string {
  return `### ${title}\n${content}`
}

/** Format an ordered or unordered list */
export function mdList(items: string[], ordered = false): string {
  return items.map((item, i) => (ordered ? `${i + 1}. ${item}` : `- ${item}`)).join('\n')
}

/** Format a checklist (subtask style) */
export function mdChecklist(items: Array<{ text: string; checked: boolean }>): string {
  return items.map((item) => `${item.checked ? '- [x]' : '- [ ]'} ${item.text}`).join('\n')
}

// =============================================================================
// Task Formatters
// =============================================================================

interface TaskInfo {
  description: string
  status?: string
  type?: string
  branch?: string
  linearId?: string
  duration?: string
  startedAt?: string
}

/** Format task header block as H2 with metadata blockquote */
export function mdTaskHeader(task: TaskInfo): string {
  const parts: string[] = []
  if (task.branch) parts.push(`Branch: \`${task.branch}\``)
  if (task.linearId) parts.push(`Linear: \`${task.linearId}\``)
  if (task.type) parts.push(`Type: ${task.type}`)
  if (task.duration) parts.push(`Duration: ${task.duration}`)
  if (task.status) parts.push(`Status: ${task.status}`)

  const meta = parts.length > 0 ? `\n> ${parts.join(' | ')}` : ''
  return `## ⚡ ${task.description}${meta}`
}

interface SubtaskItem {
  description: string
  status: string
}

/** Format subtasks as a markdown table with status icons */
export function mdSubtasks(subtasks: SubtaskItem[], currentIndex?: number): string {
  const headers = ['#', 'Status', 'Description']
  const rows = subtasks.map((s, i) => {
    const num = String(i + 1)
    let icon: string
    if (s.status === 'completed') {
      icon = '✅'
    } else if (i === currentIndex) {
      icon = '🔄'
    } else {
      icon = '⬜'
    }
    const current = i === currentIndex ? ' **← current**' : ''
    return [num, icon, `${s.description}${current}`]
  })
  return `### Subtasks\n${mdTable(headers, rows)}`
}

// =============================================================================
// Context Formatters
// =============================================================================

interface FileRef {
  path: string
  description?: string
  lineRange?: string
}

/** Format relevant files list with code formatting */
export function mdRelevantFiles(files: FileRef[]): string {
  if (files.length === 0) return ''
  const items = files.map((f) => {
    const range = f.lineRange ? `:${f.lineRange}` : ''
    const desc = f.description ? ` — ${f.description}` : ''
    return `- \`${f.path}${range}\`${desc}`
  })
  return `### Relevant Files\n${items.join('\n')}`
}

/** Format numbered instructions */
export function mdInstructions(instructions: string[]): string {
  return `### Instructions\n${mdList(instructions, true)}`
}

/** Format rules block */
export function mdRules(rules: string[]): string {
  return `### Rules\n${mdList(rules)}`
}

// =============================================================================
// Navigation Formatters
// =============================================================================

interface NextStep {
  label: string
  command: string
}

/** Format next steps as a table */
export function mdNextSteps(steps: NextStep[]): string {
  const headers = ['Command', 'Action']
  const rows = steps.map((s) => [`\`${s.command}\``, s.label])
  return `### Next\n${mdTable(headers, rows)}`
}

// =============================================================================
// Status Formatters
// =============================================================================

/** Format a key-value stats block as a table */
export function mdStats(stats: Record<string, string | number | null | undefined>): string {
  const entries = Object.entries(stats).filter(([, value]) => value != null)
  if (entries.length === 0) return ''
  const headers = ['Metric', 'Value']
  const rows = entries.map(([key, value]) => [key, String(value)])
  return mdTable(headers, rows)
}

/** Format a success/completion message */
export function mdDone(message: string, details?: string): string {
  return details ? `## ✅ ${message}\n> ${details}` : `## ✅ ${message}`
}

/** Format a warning message (bold) */
export function mdWarn(message: string): string {
  return `> ⚠️ **${message}**`
}

/** Format an error message (bold) */
export function mdError(message: string): string {
  return `> ❌ **${message}**`
}

// =============================================================================
// Composition Helper
// =============================================================================

/** Join multiple markdown sections with blank lines */
export function mdJoin(...sections: (string | null | undefined | false)[]): string {
  return sections.filter(Boolean).join('\n\n')
}

// =============================================================================
// Actionable Response (for LLM consumption)
// =============================================================================

interface MdOption {
  label: string
  command?: string
}

/**
 * Output a structured JSON response that LLMs interpret as actionable.
 * Used when a business rule blocks an action and the user must decide.
 */
export function mdActionRequired(
  status: string,
  reason: string,
  options: MdOption[],
  context?: Record<string, string>
): void {
  console.log(
    JSON.stringify({
      status,
      reason,
      ...context,
      options,
    })
  )
}
