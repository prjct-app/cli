/**
 * Top-level `index.md` for the generated vault. Pure function over
 * pre-aggregated counts — the orchestrator owns counting; this just
 * lays the markdown out.
 */

import type { LLMAnalysis } from '../../types/llm-analysis'
import type { ShippedFeature } from '../../types/storage'
import { slugify } from './_shared'

type NoteRef = { slug: string; title: string }

const wikilink = ({ slug, title }: NoteRef) => `[[${slug}|${title.replace(/[[\]|]/g, '')}]]`

export function buildIndexFile(args: {
  ships: ShippedFeature[]
  memoryTypeCounts: Map<string, number>
  tagKeyCounts: Map<string, number>
  patternsCount: number
  antiPatternsCount: number
  llmAnalysis: LLMAnalysis | null
  archiveCount: number
  releaseCount: number
  workflowCount: number
  signalsCount?: number
  recentDecisions?: NoteRef[]
  topGotchas?: NoteRef[]
}): string {
  const { ships, memoryTypeCounts, tagKeyCounts, patternsCount, antiPatternsCount, llmAnalysis } =
    args
  const lines: string[] = [
    '# Project context export (generated)',
    '',
    'Agent-readable snapshot of project memory. Regenerated on `prjct remember`, `prjct capture`,',
    '`prjct ship`, `prjct sync`, and the SessionStart / Stop hooks.',
    'Read directly with Read/Glob — no CLI round-trip needed.',
    '',
    '> ⚠️  **Snapshot, not source.** SQLite is the source of truth. Edits to files under',
    '> `_generated/` are silently overwritten on the next regen. To add memory, run',
    '> `prjct remember <type> "..."` or drop a markdown note in `../captured/` (parent directory)',
    '> with `type:` frontmatter — the Stop hook ingests it.',
    '',
  ]

  // Dashboard: the freshest, highest-stakes knowledge surfaces on the
  // landing page itself — an agent (or human) sees what matters without
  // opening a single MOC.
  if (args.recentDecisions?.length) {
    lines.push('## Recent decisions')
    for (const d of args.recentDecisions) lines.push(`- ${wikilink(d)}`)
    lines.push('')
  }
  if (args.topGotchas?.length) {
    lines.push('## Known traps')
    for (const g of args.topGotchas) lines.push(`- ${wikilink(g)}`)
    lines.push('')
  }

  if (ships.length > 0) {
    lines.push('## Ships')
    for (const ship of ships)
      lines.push(`- [${ship.name}](ships/${slugify(ship.name)}.md) — ${ship.shippedAt}`)
    lines.push('')
  }

  if (args.releaseCount > 0) {
    lines.push('## Releases')
    lines.push(
      `- [releases/index](releases/index.md) — ${args.releaseCount} versions parsed from \`CHANGELOG.md\``
    )
    lines.push('')
  }

  if (args.workflowCount > 0) {
    lines.push('## Workflows')
    lines.push(
      `- [workflows/index](workflows/index.md) — ${args.workflowCount} workflow definition(s)`
    )
    lines.push('')
  }

  if (memoryTypeCounts.size > 0) {
    lines.push('## Memory by type')
    for (const [type, count] of memoryTypeCounts) {
      lines.push(`- [${type}](memory/${type}.md) — ${count} entries`)
    }
    lines.push('')
  }

  if (tagKeyCounts.size > 0) {
    lines.push('## Memory by tag')
    lines.push('- [all tags](tags.md)')
    for (const [key, count] of tagKeyCounts) {
      lines.push(`- [${key}](tags/${slugify(key)}.md) — ${count} entries`)
    }
    lines.push('')
  }

  if (args.signalsCount && args.signalsCount > 0) {
    lines.push('## Machine signals')
    lines.push(
      `- [signals](signals.md) — ${args.signalsCount} auto-detected (hot files, missed knowledge, friction)`
    )
    lines.push('')
  }

  if (patternsCount > 0 || antiPatternsCount > 0 || llmAnalysis) {
    lines.push('## Inferred')
    if (patternsCount > 0 || antiPatternsCount > 0) {
      lines.push(
        `- [patterns](patterns.md) — ${patternsCount} patterns, ${antiPatternsCount} anti-patterns`
      )
    }
    if (llmAnalysis) {
      const archHas =
        llmAnalysis.architecture?.style ||
        llmAnalysis.architecture?.insights?.length ||
        llmAnalysis.conventions?.length
      if (archHas) {
        lines.push(
          `- [architecture](architecture.md) — ${llmAnalysis.architecture?.style ?? '—'}, ${llmAnalysis.conventions?.length ?? 0} conventions`
        )
      }
      const debtCount =
        (llmAnalysis.techDebt?.length ?? 0) +
        (llmAnalysis.riskAreas?.length ?? 0) +
        (llmAnalysis.refactorSuggestions?.length ?? 0)
      if (debtCount > 0) {
        lines.push(
          `- [tech-debt](tech-debt.md) — ${llmAnalysis.techDebt?.length ?? 0} debt items, ${llmAnalysis.riskAreas?.length ?? 0} risks, ${llmAnalysis.refactorSuggestions?.length ?? 0} refactors`
        )
      }
      if (llmAnalysis.projectInsights && llmAnalysis.projectInsights.length > 0) {
        lines.push(
          `- [insights](insights.md) — ${llmAnalysis.projectInsights.length} project insights`
        )
      }
    }
    if (args.archiveCount > 0) {
      lines.push(
        `- [analysis drill-down](analysis/index.md) — ${args.archiveCount} concepts (patterns, anti-patterns, tech-debt, risks, refactors, insights) + [history](analysis/history.md)`
      )
    }
    lines.push('')
  }

  if (
    ships.length === 0 &&
    memoryTypeCounts.size === 0 &&
    patternsCount === 0 &&
    antiPatternsCount === 0
  ) {
    lines.push(
      '> No ships, memory, or patterns yet. Run `prjct remember`, `prjct ship`, or `prjct sync`.'
    )
  }

  return `${lines.join('\n')}\n`
}
