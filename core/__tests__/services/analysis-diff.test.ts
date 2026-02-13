/**
 * Analysis Diff Tests (PRJ-275)
 *
 * Tests for diffing between consecutive analysis runs.
 */

import { describe, expect, it } from 'bun:test'
import type { AnalysisSchema } from '../../schemas/analysis'
import {
  formatAnalysisDiffMd,
  formatAnalysisDiffText,
  generateAnalysisDiff,
} from '../../services/analysis-diff'

const baseAnalysis: AnalysisSchema = {
  projectId: 'test-project',
  languages: ['TypeScript'],
  frameworks: ['Hono'],
  packageManager: 'bun',
  sourceDir: 'core',
  testDir: 'core/__tests__',
  configFiles: ['tsconfig.json'],
  fileCount: 300,
  patterns: [{ name: 'Service pattern', description: 'DI pattern' }],
  antiPatterns: [],
  analyzedAt: '2026-02-10T00:00:00.000Z',
  status: 'sealed',
  commitHash: 'abc1234',
}

describe('generateAnalysisDiff', () => {
  it('should report no changes for identical analyses', () => {
    const diff = generateAnalysisDiff(baseAnalysis, { ...baseAnalysis })
    expect(diff.hasChanges).toBe(false)
    expect(diff.items).toHaveLength(0)
    expect(diff.summary).toEqual({ added: 0, removed: 0, changed: 0 })
  })

  it('should detect added languages', () => {
    const after = { ...baseAnalysis, languages: ['TypeScript', 'Go'] }
    const diff = generateAnalysisDiff(baseAnalysis, after)
    expect(diff.hasChanges).toBe(true)
    const langAdded = diff.items.find((i) => i.field === 'Languages' && i.type === 'added')
    expect(langAdded).toBeDefined()
    expect(langAdded!.after).toBe('Go')
  })

  it('should detect removed frameworks', () => {
    const after = { ...baseAnalysis, frameworks: [] }
    const diff = generateAnalysisDiff(baseAnalysis, after)
    expect(diff.hasChanges).toBe(true)
    const removed = diff.items.find((i) => i.field === 'Frameworks' && i.type === 'removed')
    expect(removed).toBeDefined()
    expect(removed!.before).toBe('Hono')
  })

  it('should detect file count changes', () => {
    const after = { ...baseAnalysis, fileCount: 350 }
    const diff = generateAnalysisDiff(baseAnalysis, after)
    expect(diff.hasChanges).toBe(true)
    const fileCount = diff.items.find((i) => i.field === 'File count')
    expect(fileCount).toBeDefined()
    expect(fileCount!.type).toBe('changed')
    expect(fileCount!.before).toBe('300')
    expect(fileCount!.after).toBe('350')
  })

  it('should detect package manager changes', () => {
    const after = { ...baseAnalysis, packageManager: 'npm' }
    const diff = generateAnalysisDiff(baseAnalysis, after)
    expect(diff.hasChanges).toBe(true)
    const pm = diff.items.find((i) => i.field === 'Package manager')
    expect(pm).toBeDefined()
    expect(pm!.before).toBe('bun')
    expect(pm!.after).toBe('npm')
  })

  it('should detect pattern additions', () => {
    const after = {
      ...baseAnalysis,
      patterns: [
        { name: 'Service pattern', description: 'DI pattern' },
        { name: 'Repository pattern', description: 'Data access' },
      ],
    }
    const diff = generateAnalysisDiff(baseAnalysis, after)
    expect(diff.hasChanges).toBe(true)
    const patternAdded = diff.items.find((i) => i.field === 'Patterns' && i.type === 'added')
    expect(patternAdded).toBeDefined()
    expect(patternAdded!.after).toBe('Repository pattern')
  })

  it('should detect anti-pattern additions', () => {
    const after = {
      ...baseAnalysis,
      antiPatterns: [{ issue: 'Missing types', file: 'src/foo.ts', suggestion: 'Add types' }],
    }
    const diff = generateAnalysisDiff(baseAnalysis, after)
    expect(diff.hasChanges).toBe(true)
    const ap = diff.items.find((i) => i.field === 'Anti-patterns' && i.type === 'added')
    expect(ap).toBeDefined()
    expect(ap!.after).toBe('Missing types')
  })

  it('should track commit hashes', () => {
    const after = { ...baseAnalysis, commitHash: 'def5678' }
    const diff = generateAnalysisDiff(baseAnalysis, after)
    expect(diff.beforeCommit).toBe('abc1234')
    expect(diff.afterCommit).toBe('def5678')
  })

  it('should summarize counts correctly', () => {
    const after = {
      ...baseAnalysis,
      languages: ['TypeScript', 'Go'],
      frameworks: [],
      fileCount: 400,
    }
    const diff = generateAnalysisDiff(baseAnalysis, after)
    expect(diff.summary.added).toBe(1) // Go
    expect(diff.summary.removed).toBe(1) // Hono
    expect(diff.summary.changed).toBe(1) // fileCount
  })

  it('should handle multiple changes in one field', () => {
    const after = {
      ...baseAnalysis,
      languages: ['Python', 'Rust'],
    }
    const diff = generateAnalysisDiff(baseAnalysis, after)
    const langItems = diff.items.filter((i) => i.field === 'Languages')
    // TypeScript removed, Python added, Rust added
    expect(langItems).toHaveLength(3)
  })
})

describe('formatAnalysisDiffMd', () => {
  it('should format no-change diff', () => {
    const diff = generateAnalysisDiff(baseAnalysis, { ...baseAnalysis })
    const md = formatAnalysisDiffMd(diff)
    expect(md).toContain('No changes')
  })

  it('should format a diff as markdown table', () => {
    const after = { ...baseAnalysis, languages: ['TypeScript', 'Go'], fileCount: 350 }
    const diff = generateAnalysisDiff(baseAnalysis, after)
    const md = formatAnalysisDiffMd(diff)
    expect(md).toContain('| Change | Field | Detail |')
    expect(md).toContain('Go')
    expect(md).toContain('300 → 350')
  })
})

describe('formatAnalysisDiffText', () => {
  it('should format no-change diff', () => {
    const diff = generateAnalysisDiff(baseAnalysis, { ...baseAnalysis })
    const text = formatAnalysisDiffText(diff)
    expect(text).toContain('No changes')
  })

  it('should format changes as text', () => {
    const after = { ...baseAnalysis, frameworks: ['Express'] }
    const diff = generateAnalysisDiff(baseAnalysis, after)
    const text = formatAnalysisDiffText(diff)
    expect(text).toContain('+ Frameworks: Express')
    expect(text).toContain('- Frameworks: Hono')
  })
})
