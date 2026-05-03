/**
 * LLM Analysis schema — pins the validation contract used by
 * `prjct analysis-save-llm`. The bar: the LLM CAN'T accidentally
 * write garbage into SQLite that breaks the vault generator
 * downstream.
 */

import { describe, expect, it } from 'bun:test'
import { LLMAnalysisSchema, parseLlmAnalysis } from '../../schemas/llm-analysis'

const MINIMAL_VALID = {
  version: 1 as const,
  commitHash: null,
  analyzedAt: '2026-05-02T12:00:00.000Z',
  architecture: { style: 'monolith', insights: [], domains: [] },
  patterns: [],
  antiPatterns: [],
  techDebt: [],
  riskAreas: [],
  refactorSuggestions: [],
  projectInsights: [],
  conventions: [],
}

describe('LLMAnalysisSchema', () => {
  it('accepts a minimally valid payload', () => {
    const r = parseLlmAnalysis(MINIMAL_VALID)
    expect(r.ok).toBe(true)
  })

  it('rejects missing required field with a path-prefixed error', () => {
    const broken = { ...MINIMAL_VALID, architecture: undefined }
    const r = parseLlmAnalysis(broken)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('architecture')
  })

  it('rejects scalar where array is required (the regression class)', () => {
    const r = parseLlmAnalysis({ ...MINIMAL_VALID, patterns: 42 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('patterns')
  })

  it('rejects out-of-range confidence', () => {
    const r = parseLlmAnalysis({
      ...MINIMAL_VALID,
      patterns: [
        {
          name: 'x',
          description: 'd',
          locations: [],
          confidence: 1.5, // > 1
          category: 'c',
        },
      ],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('patterns.0.confidence')
  })

  it('rejects unknown severity enum', () => {
    const r = parseLlmAnalysis({
      ...MINIMAL_VALID,
      antiPatterns: [
        {
          issue: 'x',
          reasoning: 'y',
          files: [],
          suggestion: 'z',
          severity: 'critical', // not in enum
          confidence: 0.5,
        },
      ],
    })
    expect(r.ok).toBe(false)
  })

  it('accepts the full schema with optional fields populated', () => {
    const full = {
      ...MINIMAL_VALID,
      patterns: [
        {
          name: 'p1',
          description: 'd',
          locations: ['a/b.ts'],
          confidence: 0.9,
          category: 'arch',
        },
      ],
      antiPatterns: [
        {
          issue: 'i',
          reasoning: 'r',
          files: ['x'],
          suggestion: 's',
          severity: 'high' as const,
          confidence: 0.8,
        },
      ],
      techDebt: [
        {
          description: 't',
          area: 'a',
          effort: 'small' as const,
          impact: 'i',
          priority: 'medium' as const,
        },
      ],
      commands: { build: 'bun run build' },
      stack: { languages: ['TypeScript'], frameworks: ['Bun'] },
    }
    const r = LLMAnalysisSchema.safeParse(full)
    expect(r.success).toBe(true)
  })

  it('produces a multi-issue error string when several fields fail', () => {
    const r = parseLlmAnalysis({ version: 'wrong', architecture: 'string' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.split(';').length).toBeGreaterThan(1)
  })
})
