/**
 * Context Contract & Pattern Ranking
 *
 * Extracted from workflow.ts to reduce file size and improve testability.
 * Contains pattern ranking, deduplication, domain detection,
 * pattern briefing, and context contract building.
 *
 * All functions use standard markdown compatible with agents.md spec
 * (works across Claude, Codex, Jules, Cursor, and other coding agents).
 */

import type { AnalysisSchema } from '../schemas/analysis'
import { indexStorage } from '../storage/index-storage'

// =============================================================================
// Pattern Ranking Helpers (exported for testing)
// =============================================================================

/**
 * Rank patterns by metadata relevance (no hardcoded keywords).
 * Uses: source priority, framework/language match, confidence, location overlap.
 */
export function rankPatterns<
  T extends {
    source?: string
    framework?: string
    language?: string
    confidence?: number
    location?: string
    name: string
    description: string
  },
>(
  patterns: T[],
  analysis: { frameworks?: string[]; languages?: string[] } | null,
  relevantFilePaths: string[],
  limit: number
): T[] {
  if (patterns.length === 0) return []

  const frameworks = new Set((analysis?.frameworks || []).map((f) => f.toLowerCase()))
  const languages = new Set((analysis?.languages || []).map((l) => l.toLowerCase()))

  const scored = patterns.map((p) => {
    let score = 0

    // Source priority: repo patterns are project-specific, most valuable
    if (p.source === 'repo') score += 100
    else if (p.source === 'context7') score += 60
    else if (p.source === 'feedback') score += 50
    else if (p.source === 'baseline') score += 10

    // Framework match: pattern's framework matches project frameworks
    if (p.framework && frameworks.has(p.framework.toLowerCase())) score += 40

    // Language match: pattern's language matches project languages
    if (p.language && languages.has(p.language.toLowerCase())) score += 20

    // Confidence: direct signal from analysis (0-1 → 0-30 points)
    if (typeof p.confidence === 'number') score += Math.round(p.confidence * 30)

    // Location overlap: pattern's location glob matches any relevant file path
    if (p.location && relevantFilePaths.length > 0) {
      const locParts = p.location
        .toLowerCase()
        .replace(/\*+/g, '')
        .split(/[/,\s]+/)
        .filter(Boolean)
      if (
        locParts.some((part) => relevantFilePaths.some((fp) => fp.toLowerCase().includes(part)))
      ) {
        score += 25
      }
    }

    return { pattern: p, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((s) => s.pattern)
}

/** Deduplicate strings by lowercase comparison */
export function deduplicateDecisions(decisions: string[]): string[] {
  const seen = new Set<string>()
  return decisions.filter((d) => {
    const key = d
      .toLowerCase()
      .replace(/[`*_()]/g, '')
      .trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Detect domains from task description using project-specific domains */
export function detectDomainsFromTask(description: string, projectId?: string): string[] {
  const normalizedDesc = description.toLowerCase()
  const detected = new Set<string>()

  if (projectId) {
    try {
      const domainsData = indexStorage.readDomainsSync(projectId)
      if (domainsData?.domains) {
        for (const domain of domainsData.domains) {
          if (normalizedDesc.includes(domain.name.toLowerCase())) {
            detected.add(domain.name)
            continue
          }
          for (const kw of domain.keywords) {
            if (normalizedDesc.includes(kw.toLowerCase())) {
              detected.add(domain.name)
              break
            }
          }
        }
      }
    } catch {
      // Index not ready — use baseline only
    }
  }

  return detected.size > 0 ? [...detected] : ['general']
}

// =============================================================================
// Pattern Briefing & Context Contract
// =============================================================================

/**
 * Build domain-filtered pattern briefing with paired anti-patterns.
 * Each pattern is paired with its most relevant violation.
 * Output uses standard markdown (agents.md compatible — works across Claude, Codex, Jules, Cursor).
 */
export function buildPatternBriefing(
  analysis: AnalysisSchema | null,
  relevantFilePaths: string[]
): string | null {
  if (!analysis) return null

  const patterns = analysis.patterns
  const antiPatterns = analysis.antiPatterns
  if (!Array.isArray(patterns) || patterns.length === 0) return null

  const filtered = rankPatterns(patterns, analysis, relevantFilePaths, 5)

  // Track used anti-patterns to avoid reuse across briefing blocks
  const usedAntiPatterns = new Set<number>()

  const blocks = filtered.map((p, i) => {
    const src = p.source ? ` [${p.source}]` : ''
    const loc = p.location ? ` (\`${p.location}\`)` : ''

    // Find matching anti-pattern by keyword overlap (best match, no reuse)
    const patternWords = p.name
      .toLowerCase()
      .split(/[\s\-_/]+/)
      .filter((w) => w.length > 2)
    let matchingAnti: (typeof antiPatterns)[number] | undefined
    if (Array.isArray(antiPatterns)) {
      for (let j = 0; j < antiPatterns.length; j++) {
        if (usedAntiPatterns.has(j)) continue
        const antiText = `${antiPatterns[j].issue} ${antiPatterns[j].suggestion}`.toLowerCase()
        if (patternWords.some((word) => antiText.includes(word))) {
          matchingAnti = antiPatterns[j]
          usedAntiPatterns.add(j)
          break
        }
      }
    }

    const lines = [`**${i + 1}. ${p.name}**${src}`, `   ${p.description}${loc}`]

    if (matchingAnti) {
      lines.push(`   - VIOLATION: ${matchingAnti.issue} — ${matchingAnti.suggestion}`)
    }

    return lines.join('\n')
  })

  return `### Pattern Briefing (for this task)\n\n${blocks.join('\n\n')}`
}

/**
 * Build context contract with Locked Decisions and Task Patterns.
 * Uses standard markdown structure compatible with agents.md spec
 * (works across Claude, Codex, Jules, Cursor, and other coding agents).
 */
export function buildContextContract(
  task: string,
  files: Array<{ path: string; reasons: string[] }>,
  analysis: AnalysisSchema | null,
  estimate?: {
    taskType: string
    estimatedPoints: number
    estimatedMinutes: number
    source: string
  },
  domains?: string[],
  repoAnalysis?: Record<string, unknown> | null
): string {
  const relevantFilePaths = files.map((f) => f.path)
  const topFiles = files.slice(0, 6).map((f) => `\`${f.path}\``)

  const lines = ['### Context Contract', `- **Goal**: ${task}`]

  if (estimate) {
    lines.push(
      `- **Scope**: ${estimate.taskType} · ~${estimate.estimatedPoints}pts · ~${estimate.estimatedMinutes}min (${estimate.source})`
    )
  }

  if (domains && domains.length > 0) {
    lines.push(`- **Domains**: ${domains.join(', ')}`)
  }

  const syncHint = 'Run `prjct sync` to improve file targeting'
  lines.push(`- **Key files**: ${topFiles.length > 0 ? topFiles.join(', ') : syncHint}`)

  // --- Locked Decisions (NON-NEGOTIABLE) ---
  const lockedDecisions: string[] = [
    'All commits include footer: `Generated with [p/](https://www.prjct.app/)`',
    'Never commit directly to main/master',
  ]

  // Add repo-specific rules
  const repoRules = repoAnalysis?.rules
  if (Array.isArray(repoRules)) {
    for (const rule of repoRules) {
      if (typeof rule === 'string') {
        lockedDecisions.push(rule)
      }
    }
  }

  // Convert high-severity anti-patterns to positive rules
  const antiPatterns = analysis?.antiPatterns || []
  if (Array.isArray(antiPatterns)) {
    const highSeverity = antiPatterns.filter((a) => a.severity === 'high')
    for (const a of highSeverity.slice(0, 3)) {
      lockedDecisions.push(a.suggestion)
    }
  }

  // Add high-confidence repo-source patterns as locked decisions
  const patterns = analysis?.patterns || []
  const repoPatternNames = new Set<string>()
  if (Array.isArray(patterns)) {
    const repoPatterns = rankPatterns(
      patterns.filter((p) => p.source === 'repo'),
      analysis,
      relevantFilePaths,
      3
    )
    for (const p of repoPatterns) {
      const loc = p.location ? ` (\`${p.location}\`)` : ''
      lockedDecisions.push(`${p.description}${loc}`)
      repoPatternNames.add(p.name)
    }
  }

  const dedupedDecisions = deduplicateDecisions(lockedDecisions)

  lines.push('')
  lines.push('#### Locked Decisions (NON-NEGOTIABLE)')
  for (const decision of dedupedDecisions) {
    lines.push(`- ${decision}`)
  }

  // --- Task Patterns (MUST follow) ---
  // Exclude patterns already promoted to Locked Decisions to avoid duplication
  const candidatePatterns = Array.isArray(patterns)
    ? patterns.filter((p) => !repoPatternNames.has(p.name))
    : []
  // Only show Task Patterns if there are candidates not already in Locked Decisions
  const taskPatterns =
    candidatePatterns.length > 0
      ? rankPatterns(candidatePatterns, analysis, relevantFilePaths || [], 3)
      : []

  if (taskPatterns.length > 0) {
    lines.push('')
    lines.push('#### Task Patterns (MUST follow)')
    taskPatterns.forEach((p, i) => {
      const loc = p.location ? ` (\`${p.location}\`)` : ''
      lines.push(`${i + 1}. **${p.name}** — ${p.description}${loc}`)
    })
  }

  return lines.join('\n')
}
