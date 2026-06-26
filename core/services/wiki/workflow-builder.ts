/**
 * Render workflow_rules from SQLite as one Markdown file per `command`
 * under `_generated/workflows/<command>.md`. Read-only snapshot — to
 * edit a workflow, drop a `.md` with the same schema in the parent
 * `<vault>/workflows/` directory and the Stop hook ingests it (M1b
 * bidirectional pipeline).
 *
 * Format mirrors `prjct workflow <name>` CLI output: gates first,
 * then steps in sortOrder, then hooks/instructions. Each rule keeps
 * its id so the user can `prjct workflow rm <id>` from the file.
 */

import type { WorkflowRule } from '../../types/storage/extended'
import { WORKFLOW_MAP_FILE } from './_shared'

export function buildWorkflowFiles(rules: WorkflowRule[]): {
  files: Map<string, string>
  commandCount: number
} {
  const files = new Map<string, string>()
  if (rules.length === 0) return { files, commandCount: 0 }

  // Group by command (the workflow name: ship, task, sync, done, etc.)
  const byCommand = new Map<string, WorkflowRule[]>()
  for (const rule of rules) {
    const list = byCommand.get(rule.command) ?? []
    list.push(rule)
    byCommand.set(rule.command, list)
  }

  for (const [command, commandRules] of byCommand) {
    const enabled = commandRules.filter((r) => r.enabled)
    const gates = enabled.filter((r) => r.type === 'gate').sort((a, b) => a.sortOrder - b.sortOrder)
    const steps = enabled.filter((r) => r.type === 'step').sort((a, b) => a.sortOrder - b.sortOrder)
    const hooks = enabled.filter((r) => r.type === 'hook').sort((a, b) => a.sortOrder - b.sortOrder)
    const instructions = enabled
      .filter((r) => r.type === 'instruction')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const disabled = commandRules.filter((r) => !r.enabled)

    const lines: string[] = []
    lines.push('---')
    lines.push(`name: ${command}`)
    lines.push(`rules: ${commandRules.length}`)
    lines.push(`enabled: ${enabled.length}`)
    if (disabled.length > 0) lines.push(`disabled: ${disabled.length}`)
    lines.push('---')
    lines.push('')
    lines.push(`# Workflow: ${command}`)
    lines.push('')

    if (gates.length > 0) {
      lines.push('## Gates (must pass before workflow runs)')
      lines.push('')
      for (const r of gates) {
        const desc = r.description ? ` — ${r.description}` : ''
        const when = r.whenExpr ? ` _(when: \`${r.whenExpr}\`)_` : ''
        lines.push(`- \`${r.action}\`${desc}${when} — id: ${r.id}`)
      }
      lines.push('')
    }

    if (steps.length > 0) {
      lines.push('## Steps (run in order)')
      lines.push('')
      let i = 1
      for (const r of steps) {
        const desc = r.description ?? r.action
        lines.push(`${i}. **${desc}** — \`${r.action}\` (id: ${r.id})`)
        i += 1
      }
      lines.push('')
    }

    if (hooks.length > 0) {
      lines.push('## Hooks')
      lines.push('')
      for (const r of hooks) {
        const desc = r.description ? ` — ${r.description}` : ''
        const pos = r.position ? ` _(position: ${r.position})_` : ''
        lines.push(`- \`${r.action}\`${desc}${pos} — id: ${r.id}`)
      }
      lines.push('')
    }

    if (instructions.length > 0) {
      lines.push('## Instructions')
      lines.push('')
      for (const r of instructions) {
        const desc = r.description ? ` — ${r.description}` : ''
        lines.push(`- \`${r.action}\`${desc} — id: ${r.id}`)
      }
      lines.push('')
    }

    if (disabled.length > 0) {
      lines.push('## Disabled rules')
      lines.push('')
      for (const r of disabled) {
        const desc = r.description ? ` — ${r.description}` : ''
        lines.push(`- (${r.type}) \`${r.action}\`${desc} — id: ${r.id}`)
      }
      lines.push('')
    }

    lines.push('---')
    lines.push('')
    lines.push(
      `> Edit this workflow: drop a Markdown file at \`<vault>/workflows/${command}.md\` (NOT under \`_generated/\`) with the same frontmatter + sections. The Stop hook ingests it and overrides these rules.`
    )

    files.set(`workflows/${command}.md`, `${lines.join('\n')}\n`)
  }

  // Index file listing all workflows
  const indexLines: string[] = ['# Workflows', '']
  indexLines.push(
    'Workflow definitions stored in SQLite, rendered as Markdown for inspection. To edit, see the per-workflow page.'
  )
  indexLines.push('')
  for (const [command, commandRules] of byCommand) {
    const enabled = commandRules.filter((r) => r.enabled).length
    indexLines.push(`- [${command}](${command}.md) — ${enabled} active rule(s)`)
  }
  files.set(WORKFLOW_MAP_FILE, `${indexLines.join('\n')}\n`)

  return { files, commandCount: byCommand.size }
}
