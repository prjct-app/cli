/**
 * Pattern Enforcement System Tests
 *
 * Tests for metadata-driven pattern ranking, pattern briefing, context contract,
 * and deduplication helpers used in the task workflow.
 */

import { describe, expect, it } from 'bun:test'
import {
  buildContextContract,
  buildPatternBriefing,
  deduplicateDecisions,
  rankPatterns,
} from '../../commands/context-contract'
import type { AnalysisSchema } from '../../schemas/analysis'

// =============================================================================
// Test Fixtures
// =============================================================================

const makeAnalysis = (overrides: Partial<AnalysisSchema> = {}): AnalysisSchema => ({
  projectId: 'test-project',
  languages: ['TypeScript'],
  frameworks: ['React', 'Next.js'],
  configFiles: [],
  fileCount: 100,
  patterns: [],
  antiPatterns: [],
  analyzedAt: new Date().toISOString(),
  ...overrides,
})

const FRONTEND_PATTERNS = [
  {
    name: 'UiButton abstraction',
    description: 'Buttons are wrapped in UiButton instead of native button',
    location: 'components/**',
    source: 'repo' as const,
  },
  {
    name: 'Server-first rendering',
    description: 'Default to server components, use client only where needed',
    framework: 'Next.js',
    source: 'baseline' as const,
  },
  {
    name: 'Type-first API surfaces',
    description: 'Define reusable domain types for all inputs/outputs',
    source: 'baseline' as const,
  },
  {
    name: 'next/image for images',
    description: 'Use next/image for optimized image delivery',
    location: 'app/** or src/**',
    source: 'repo' as const,
  },
  {
    name: 'HeroUI component system',
    description: 'UI components sourced from HeroUI/NextUI packages',
    location: 'components/**',
    source: 'repo' as const,
  },
]

const ANTI_PATTERNS = [
  {
    issue: 'Unbounded any type',
    file: 'multiple',
    suggestion: 'Use explicit types or unknown with narrowing',
    severity: 'high' as const,
  },
  {
    issue: 'UI primitives bypassing design system',
    file: 'multiple',
    suggestion: 'Use approved component abstractions before introducing raw HTML controls',
    severity: 'medium' as const,
  },
  {
    issue: 'Client components without need',
    file: 'multiple',
    suggestion: 'Avoid unnecessary use client directives',
    severity: 'medium' as const,
  },
  {
    issue: 'Raw img usage',
    file: 'multiple',
    suggestion: 'Use next/image unless documented exception',
    severity: 'low' as const,
  },
]

// =============================================================================
// rankPatterns
// =============================================================================

describe('rankPatterns', () => {
  it('scores repo source highest', () => {
    const patterns = [
      { name: 'Baseline', description: 'A baseline', source: 'baseline' as const },
      { name: 'Repo', description: 'A repo pattern', source: 'repo' as const },
      { name: 'Context7', description: 'From docs', source: 'context7' as const },
    ]
    const result = rankPatterns(patterns, null, [], 3)
    expect(result[0].name).toBe('Repo')
    expect(result[1].name).toBe('Context7')
    expect(result[2].name).toBe('Baseline')
  })

  it('scores feedback source between context7 and baseline', () => {
    const patterns = [
      { name: 'Baseline', description: 'A baseline', source: 'baseline' as const },
      { name: 'Feedback', description: 'User feedback', source: 'feedback' as const },
    ]
    const result = rankPatterns(patterns, null, [], 2)
    expect(result[0].name).toBe('Feedback')
    expect(result[1].name).toBe('Baseline')
  })

  it('boosts patterns matching project frameworks', () => {
    const patterns = [
      {
        name: 'Vue pattern',
        description: 'Vue specific',
        framework: 'Vue',
        source: 'baseline' as const,
      },
      {
        name: 'React pattern',
        description: 'React specific',
        framework: 'React',
        source: 'baseline' as const,
      },
    ]
    const analysis = { frameworks: ['React'], languages: [] }
    const result = rankPatterns(patterns, analysis, [], 2)
    expect(result[0].name).toBe('React pattern')
  })

  it('boosts patterns matching project languages', () => {
    const patterns = [
      {
        name: 'Python pattern',
        description: 'Python specific',
        language: 'Python',
        source: 'baseline' as const,
      },
      {
        name: 'TypeScript pattern',
        description: 'TS specific',
        language: 'TypeScript',
        source: 'baseline' as const,
      },
    ]
    const analysis = { frameworks: [], languages: ['TypeScript'] }
    const result = rankPatterns(patterns, analysis, [], 2)
    expect(result[0].name).toBe('TypeScript pattern')
  })

  it('uses confidence score', () => {
    const patterns = [
      { name: 'Low conf', description: 'Low', confidence: 0.1, source: 'baseline' as const },
      { name: 'High conf', description: 'High', confidence: 0.9, source: 'baseline' as const },
    ]
    const result = rankPatterns(patterns, null, [], 2)
    expect(result[0].name).toBe('High conf')
  })

  it('boosts patterns with location overlap', () => {
    const patterns = [
      { name: 'No location', description: 'Generic', source: 'baseline' as const },
      {
        name: 'Components pattern',
        description: 'For components',
        location: 'components/**',
        source: 'baseline' as const,
      },
    ]
    const result = rankPatterns(
      patterns,
      null,
      ['components/Button.tsx', 'components/Modal.tsx'],
      2
    )
    expect(result[0].name).toBe('Components pattern')
  })

  it('combines multiple scoring signals', () => {
    const patterns = [
      {
        name: 'Full match',
        description: 'Everything matches',
        source: 'repo' as const,
        framework: 'React',
        language: 'TypeScript',
        confidence: 0.9,
        location: 'src/**',
      },
      { name: 'Partial match', description: 'Only source', source: 'repo' as const },
    ]
    const analysis = { frameworks: ['React'], languages: ['TypeScript'] }
    const result = rankPatterns(patterns, analysis, ['src/app.tsx'], 2)
    // Full match should score much higher: 100 + 40 + 20 + 27 + 25 = 212 vs 100
    expect(result[0].name).toBe('Full match')
  })

  it('respects the limit parameter', () => {
    const patterns = Array.from({ length: 10 }, (_, i) => ({
      name: `Pattern ${i}`,
      description: `Description ${i}`,
      source: 'baseline' as const,
    }))
    const result = rankPatterns(patterns, null, [], 3)
    expect(result.length).toBe(3)
  })

  it('returns empty array for empty input', () => {
    expect(rankPatterns([], null, [], 5)).toEqual([])
  })

  it('handles null analysis gracefully', () => {
    const patterns = [{ name: 'Test', description: 'Test', source: 'repo' as const }]
    const result = rankPatterns(patterns, null, [], 5)
    expect(result.length).toBe(1)
  })

  it('handles empty relevant file paths', () => {
    const patterns = [
      {
        name: 'With location',
        description: 'Has location',
        location: 'src/**',
        source: 'baseline' as const,
      },
    ]
    const result = rankPatterns(patterns, null, [], 5)
    expect(result.length).toBe(1)
  })
})

// =============================================================================
// deduplicateDecisions
// =============================================================================

describe('deduplicateDecisions', () => {
  it('removes exact duplicates', () => {
    const result = deduplicateDecisions(['Never commit to main', 'Never commit to main'])
    expect(result).toEqual(['Never commit to main'])
  })

  it('removes case-insensitive duplicates', () => {
    const result = deduplicateDecisions(['Use explicit types', 'use explicit types'])
    expect(result).toEqual(['Use explicit types'])
  })

  it('removes duplicates with markdown formatting differences', () => {
    const result = deduplicateDecisions([
      'Use `next/image` for images',
      'Use next/image for images',
    ])
    expect(result).toEqual(['Use `next/image` for images'])
  })

  it('preserves unique entries', () => {
    const result = deduplicateDecisions(['Rule A', 'Rule B', 'Rule C'])
    expect(result).toEqual(['Rule A', 'Rule B', 'Rule C'])
  })

  it('handles empty array', () => {
    expect(deduplicateDecisions([])).toEqual([])
  })

  it('handles entries with parentheses/location', () => {
    const result = deduplicateDecisions([
      'Use UiButton (`components/**`)',
      'Use UiButton (components/**)',
    ])
    expect(result).toEqual(['Use UiButton (`components/**`)'])
  })
})

// =============================================================================
// buildPatternBriefing
// =============================================================================

describe('buildPatternBriefing', () => {
  it('returns null when analysis is null', () => {
    expect(buildPatternBriefing(null, [])).toBeNull()
  })

  it('returns null when patterns array is empty', () => {
    const analysis = makeAnalysis({ patterns: [] })
    expect(buildPatternBriefing(analysis, [])).toBeNull()
  })

  it('produces markdown with Pattern Briefing heading', () => {
    const analysis = makeAnalysis({
      patterns: FRONTEND_PATTERNS,
      antiPatterns: ANTI_PATTERNS,
    })
    const result = buildPatternBriefing(analysis, ['components/Button.tsx'])
    expect(result).toContain('### Pattern Briefing (for this task)')
  })

  it('numbers patterns sequentially', () => {
    const analysis = makeAnalysis({
      patterns: FRONTEND_PATTERNS,
    })
    const result = buildPatternBriefing(analysis, [])!
    expect(result).toContain('**1.')
    expect(result).toContain('**2.')
  })

  it('includes source tag when available', () => {
    const analysis = makeAnalysis({
      patterns: [{ name: 'Test pattern', description: 'desc', source: 'repo' }],
    })
    const result = buildPatternBriefing(analysis, [])!
    expect(result).toContain('[repo]')
  })

  it('pairs patterns with matching anti-patterns', () => {
    const analysis = makeAnalysis({
      patterns: [
        { name: 'UiButton abstraction', description: 'Use UiButton for buttons', source: 'repo' },
      ],
      antiPatterns: [
        {
          issue: 'UI primitives bypassing design system',
          file: 'multiple',
          suggestion: 'Use component abstractions',
        },
      ],
    })
    const result = buildPatternBriefing(analysis, [])!
    expect(result).toContain('VIOLATION:')
    expect(result).toContain('UI primitives bypassing design system')
  })

  it('does not reuse anti-patterns across multiple briefing blocks', () => {
    const analysis = makeAnalysis({
      patterns: [
        { name: 'Type-first API', description: 'Use explicit types everywhere' },
        { name: 'Type safety in forms', description: 'Use typed form validation' },
      ],
      antiPatterns: [
        { issue: 'Unbounded any type', file: 'multiple', suggestion: 'Use explicit types' },
      ],
    })
    const result = buildPatternBriefing(analysis, [])!
    // Only one pattern should have the VIOLATION, not both
    const violationCount = (result.match(/VIOLATION:/g) || []).length
    expect(violationCount).toBe(1)
  })

  it('handles patterns without matching anti-patterns', () => {
    const analysis = makeAnalysis({
      patterns: [{ name: 'Custom pattern', description: 'No matching anti-pattern' }],
      antiPatterns: [{ issue: 'Completely unrelated', file: 'x.ts', suggestion: 'Do something' }],
    })
    const result = buildPatternBriefing(analysis, [])!
    expect(result).not.toContain('VIOLATION:')
  })

  it('limits output to 5 patterns', () => {
    const manyPatterns = Array.from({ length: 10 }, (_, i) => ({
      name: `Pattern ${i}`,
      description: `Description ${i}`,
    }))
    const analysis = makeAnalysis({ patterns: manyPatterns })
    const result = buildPatternBriefing(analysis, [])!
    expect((result.match(/\*\*\d+\./g) || []).length).toBeLessThanOrEqual(5)
  })

  it('ranks repo patterns above baseline', () => {
    const analysis = makeAnalysis({
      patterns: [
        { name: 'Baseline pattern', description: 'Generic advice', source: 'baseline' },
        { name: 'Repo pattern', description: 'Project-specific rule', source: 'repo' },
      ],
    })
    const result = buildPatternBriefing(analysis, [])!
    // Repo pattern should appear first (numbered **1.)
    const repoIdx = result.indexOf('Repo pattern')
    const baselineIdx = result.indexOf('Baseline pattern')
    expect(repoIdx).toBeLessThan(baselineIdx)
  })

  it('uses indented list items (not blockquotes) for VIOLATION lines', () => {
    const analysis = makeAnalysis({
      patterns: [{ name: 'Type-first', description: 'Use explicit types' }],
      antiPatterns: [
        { issue: 'Unbounded any type', file: 'x.ts', suggestion: 'Use explicit types' },
      ],
    })
    const result = buildPatternBriefing(analysis, [])!
    // Should use indented list format, NOT blockquote (>)
    expect(result).toContain('   - VIOLATION:')
    expect(result).not.toMatch(/^> VIOLATION:/m)
  })
})

// =============================================================================
// buildContextContract
// =============================================================================

describe('buildContextContract', () => {
  const baseFiles = [
    { path: 'src/app.tsx', reasons: ['entry point'] },
    { path: 'src/utils.ts', reasons: ['utility'] },
  ]

  it('only contains key files and optional anti-patterns (no goal/scope/domains)', () => {
    const result = buildContextContract(baseFiles, null)
    expect(result).toContain('Context Contract')
    expect(result).toContain('`src/app.tsx`')
    expect(result).not.toContain('**Goal**')
    expect(result).not.toContain('**Scope**')
    expect(result).not.toContain('**Domains**')
  })

  it('surfaces high-severity anti-patterns as task-specific guards', () => {
    const analysis = makeAnalysis({
      antiPatterns: [
        {
          issue: 'Unbounded any',
          file: 'x.ts',
          suggestion: 'Use explicit types',
          severity: 'high',
        },
        { issue: 'Minor issue', file: 'y.ts', suggestion: 'Minor fix', severity: 'low' },
      ],
    })
    const result = buildContextContract([], analysis)
    expect(result).toContain('Avoid (high-severity)')
    expect(result).toContain('Use explicit types')
    expect(result).not.toContain('Minor fix')
  })

  it('omits avoid section when no high-severity anti-patterns', () => {
    const analysis = makeAnalysis({
      antiPatterns: [
        { issue: 'Minor issue', file: 'y.ts', suggestion: 'Minor fix', severity: 'low' },
      ],
    })
    const result = buildContextContract([], analysis)
    expect(result).not.toContain('Avoid')
  })

  it('shows key files', () => {
    const result = buildContextContract(baseFiles, null)
    expect(result).toContain('`src/app.tsx`')
    expect(result).toContain('`src/utils.ts`')
  })

  it('shows sync hint when no files available', () => {
    const result = buildContextContract([], null)
    expect(result).toContain('prjct sync')
  })

  it('does NOT include Locked Decisions or Task Patterns', () => {
    const analysis = makeAnalysis({
      patterns: [
        { name: 'Generic pattern', description: 'A generic baseline', source: 'baseline' },
      ],
    })
    const result = buildContextContract(
      [{ path: 'src/app.tsx', reasons: ['entry point'] }],
      analysis
    )
    expect(result).not.toContain('Task Patterns')
    expect(result).not.toContain('Locked Decisions')
  })
})
