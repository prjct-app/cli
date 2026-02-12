/**
 * Markdown formatter utilities for --md flag output
 *
 * Produces clean markdown optimized for LLM consumption.
 * Used by all CLI commands when invoked with --md.
 */

// =============================================================================
// Section Formatters
// =============================================================================

/** Format a section heading with content */
export function mdSection(title: string, content: string, _level: 2 | 3 = 2): string {
  return `${title}\n${content}`
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

/** Format task header block */
export function mdTaskHeader(task: TaskInfo): string {
  const parts: string[] = []
  if (task.branch) parts.push(`Branch: ${task.branch}`)
  if (task.linearId) parts.push(`Linear: ${task.linearId}`)
  if (task.type) parts.push(`Type: ${task.type}`)
  if (task.duration) parts.push(`Duration: ${task.duration}`)

  const meta = parts.length > 0 ? `\n${parts.join(' | ')}` : ''
  return `Task: ${task.description}${meta}`
}

interface SubtaskItem {
  description: string
  status: string
}

/** Format subtasks as a checklist */
export function mdSubtasks(subtasks: SubtaskItem[], currentIndex?: number): string {
  const items = subtasks.map((s, i) => {
    const checked = s.status === 'completed'
    const current = i === currentIndex ? ' ← current' : ''
    return `${checked ? '- [x]' : '- [ ]'} ${s.description}${current}`
  })
  return `Subtasks\n${items.join('\n')}`
}

// =============================================================================
// Context Formatters
// =============================================================================

interface FileRef {
  path: string
  description?: string
  lineRange?: string
}

/** Format relevant files list */
export function mdRelevantFiles(files: FileRef[]): string {
  if (files.length === 0) return ''
  const items = files.map((f) => {
    const range = f.lineRange ? `:${f.lineRange}` : ''
    const desc = f.description ? ` — ${f.description}` : ''
    return `- ${f.path}${range}${desc}`
  })
  return `Relevant files\n${items.join('\n')}`
}

/** Format numbered instructions */
export function mdInstructions(instructions: string[]): string {
  return `Instructions\n${mdList(instructions, true)}`
}

/** Format rules block */
export function mdRules(rules: string[]): string {
  return `Rules\n${mdList(rules)}`
}

// =============================================================================
// Navigation Formatters
// =============================================================================

interface NextStep {
  label: string
  command: string
}

/** Format next steps with commands */
export function mdNextSteps(steps: NextStep[]): string {
  const items = steps.map((s) => `- ${s.label}: ${s.command}`)
  return `Next\n${items.join('\n')}`
}

// =============================================================================
// Status Formatters
// =============================================================================

/** Format a key-value stats block */
export function mdStats(stats: Record<string, string | number | null | undefined>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(stats)) {
    if (value != null) {
      lines.push(`- ${key}: ${value}`)
    }
  }
  return lines.join('\n')
}

/** Format a success/completion message */
export function mdDone(message: string, details?: string): string {
  return details ? `${message}\n${details}` : message
}

/** Format a warning message */
export function mdWarn(message: string): string {
  return `> ⚠️ ${message}`
}

/** Format an error message */
export function mdError(message: string): string {
  return `> ❌ ${message}`
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
