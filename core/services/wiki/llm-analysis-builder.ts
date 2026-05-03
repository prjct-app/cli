/**
 * Top-level summary files derived directly from the latest LLM
 * analysis: patterns, architecture, tech-debt, project insights. The
 * concept-level drill-downs (one file per pattern, etc.) are built
 * separately in `concept-builder.ts`.
 */

import type { LLMAnalysis } from '../../types/llm-analysis'

export function buildPatternsFile(
  patterns: {
    name: string
    description: string
    locations?: string[]
    category?: string
    confidence?: number
  }[],
  antiPatterns: {
    issue: string
    suggestion: string
    files?: string[]
    reasoning?: string
    severity?: string
    confidence?: number
  }[]
): string | null {
  if (patterns.length === 0 && antiPatterns.length === 0) return null
  const lines: string[] = ['# Patterns (inferred)', '']
  if (patterns.length > 0) {
    lines.push('## Patterns')
    for (const p of patterns) {
      const loc =
        p.locations && p.locations.length > 0 ? ` — ${p.locations.slice(0, 3).join(', ')}` : ''
      const cat = p.category ? ` _[${p.category}]_` : ''
      lines.push(`- **${p.name}**${cat}: ${p.description}${loc}`)
    }
    lines.push('')
  }
  if (antiPatterns.length > 0) {
    lines.push('## Anti-patterns')
    for (const a of antiPatterns) {
      const file = a.files && a.files.length > 0 ? ` (${a.files[0]})` : ''
      const sev = a.severity ? ` _[${a.severity}]_` : ''
      lines.push(`- **${a.issue}**${sev}${file} — ${a.suggestion}`)
      if (a.reasoning) lines.push(`  - Why: ${a.reasoning}`)
    }
    lines.push('')
  }
  lines.push('> Source: `prjct sync` analysis. Provenance: INFR.')
  return `${lines.join('\n')}\n`
}

export function buildArchitectureFile(a: LLMAnalysis): string | null {
  const { architecture, conventions } = a
  const hasArch =
    architecture &&
    (architecture.style || architecture.insights?.length || architecture.domains?.length)
  if (!hasArch && (!conventions || conventions.length === 0)) return null

  const lines: string[] = ['# Architecture', '']
  if (architecture?.style) {
    lines.push(`**Style**: ${architecture.style}`, '')
  }
  if (architecture?.domains && architecture.domains.length > 0) {
    lines.push('## Domains')
    for (const d of architecture.domains) lines.push(`- ${d}`)
    lines.push('')
  }
  if (architecture?.insights && architecture.insights.length > 0) {
    lines.push('## Insights')
    for (const i of architecture.insights) lines.push(`- ${i}`)
    lines.push('')
  }
  if (conventions && conventions.length > 0) {
    lines.push('## Conventions')
    for (const c of conventions) {
      const ex = c.example ? ` — \`${c.example}\`` : ''
      lines.push(`- **${c.category}**: ${c.rule}${ex}`)
    }
    lines.push('')
  }
  lines.push('> Source: `prjct sync` LLM analysis.')
  return `${lines.join('\n')}\n`
}

export function buildTechDebtFile(a: LLMAnalysis): string | null {
  const { techDebt, riskAreas, refactorSuggestions } = a
  const total =
    (techDebt?.length ?? 0) + (riskAreas?.length ?? 0) + (refactorSuggestions?.length ?? 0)
  if (total === 0) return null

  const lines: string[] = ['# Tech debt, risks & refactors', '']
  if (techDebt && techDebt.length > 0) {
    lines.push('## Tech debt')
    for (const t of techDebt) {
      lines.push(
        `- **${t.description}** _[${t.priority}, ${t.effort}]_ — ${t.area}. Impact: ${t.impact}`
      )
    }
    lines.push('')
  }
  if (riskAreas && riskAreas.length > 0) {
    lines.push('## Risk areas')
    for (const r of riskAreas) {
      lines.push(`- **${r.path}** _[${r.severity}]_ — ${r.reason}. Risk: ${r.risk}`)
    }
    lines.push('')
  }
  if (refactorSuggestions && refactorSuggestions.length > 0) {
    lines.push('## Refactor suggestions')
    for (const r of refactorSuggestions) {
      const files = r.files && r.files.length > 0 ? ` (${r.files.slice(0, 3).join(', ')})` : ''
      lines.push(`- **${r.description}** _[${r.effort}]_${files} — ${r.benefit}`)
    }
    lines.push('')
  }
  lines.push('> Source: `prjct sync` LLM analysis.')
  return `${lines.join('\n')}\n`
}

export function buildInsightsFile(a: LLMAnalysis): string | null {
  if (!a.projectInsights || a.projectInsights.length === 0) return null
  const lines: string[] = ['# Project insights', '']
  for (const i of a.projectInsights) lines.push(`- ${i}`)
  lines.push('', '> Source: `prjct sync` LLM analysis.')
  return `${lines.join('\n')}\n`
}
