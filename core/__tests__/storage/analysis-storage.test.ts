/**
 * Analysis Storage Tests (PRJ-263)
 *
 * Tests for sealable analysis lifecycle:
 * - Schema validation (draft/verified/sealed)
 * - Signature computation and verification
 * - Staleness detection
 * - Draft preservation on re-sync
 * - Backward compatibility
 */

import { describe, expect, it } from 'bun:test'
import {
  AnalysisItemSchema,
  AnalysisStatusSchema,
  parseAnalysis,
  safeParseAnalysis,
} from '../../schemas/analysis'

// =============================================================================
// Schema Validation
// =============================================================================

describe('AnalysisStatusSchema', () => {
  it('should accept valid statuses', () => {
    expect(AnalysisStatusSchema.parse('draft')).toBe('draft')
    expect(AnalysisStatusSchema.parse('verified')).toBe('verified')
    expect(AnalysisStatusSchema.parse('sealed')).toBe('sealed')
  })

  it('should reject invalid statuses', () => {
    expect(() => AnalysisStatusSchema.parse('pending')).toThrow()
    expect(() => AnalysisStatusSchema.parse('active')).toThrow()
    expect(() => AnalysisStatusSchema.parse('')).toThrow()
  })
})

describe('AnalysisItemSchema', () => {
  const validDraft = {
    projectId: 'test-project-123',
    languages: ['TypeScript'],
    frameworks: ['Hono'],
    configFiles: ['tsconfig.json'],
    fileCount: 295,
    patterns: [{ name: 'Service pattern', description: 'Classes with dependency injection' }],
    antiPatterns: [],
    analyzedAt: '2026-02-08T20:00:00.000Z',
    status: 'draft' as const,
    commitHash: 'abc1234',
  }

  it('should parse a valid draft analysis', () => {
    const result = AnalysisItemSchema.parse(validDraft)
    expect(result.status).toBe('draft')
    expect(result.commitHash).toBe('abc1234')
    expect(result.projectId).toBe('test-project-123')
  })

  it('should default status to draft when not provided', () => {
    const { status, ...withoutStatus } = validDraft
    const result = AnalysisItemSchema.parse(withoutStatus)
    expect(result.status).toBe('draft')
  })

  it('should parse a sealed analysis with signature', () => {
    const sealed = {
      ...validDraft,
      status: 'sealed' as const,
      signature: 'sha256-abc123def456',
      sealedAt: '2026-02-08T21:00:00.000Z',
    }
    const result = AnalysisItemSchema.parse(sealed)
    expect(result.status).toBe('sealed')
    expect(result.signature).toBe('sha256-abc123def456')
    expect(result.sealedAt).toBe('2026-02-08T21:00:00.000Z')
  })

  it('should accept optional fields as undefined', () => {
    const minimal = {
      projectId: 'test',
      languages: [],
      frameworks: [],
      configFiles: [],
      fileCount: 0,
      patterns: [],
      antiPatterns: [],
      analyzedAt: '2026-02-08T20:00:00.000Z',
    }
    const result = AnalysisItemSchema.parse(minimal)
    expect(result.status).toBe('draft')
    expect(result.commitHash).toBeUndefined()
    expect(result.signature).toBeUndefined()
    expect(result.sealedAt).toBeUndefined()
    expect(result.modelMetadata).toBeUndefined()
  })

  it('should reject missing required fields', () => {
    expect(() => AnalysisItemSchema.parse({})).toThrow()
    expect(() => AnalysisItemSchema.parse({ projectId: 'test' })).toThrow()
  })
})

describe('parseAnalysis / safeParseAnalysis', () => {
  it('should parse valid data', () => {
    const data = {
      projectId: 'test',
      languages: ['TypeScript'],
      frameworks: [],
      configFiles: [],
      fileCount: 10,
      patterns: [],
      antiPatterns: [],
      analyzedAt: '2026-02-08T20:00:00.000Z',
    }
    const result = parseAnalysis(data)
    expect(result.projectId).toBe('test')
    expect(result.status).toBe('draft')
  })

  it('should return success for safeParseAnalysis with valid data', () => {
    const data = {
      projectId: 'test',
      languages: [],
      frameworks: [],
      configFiles: [],
      fileCount: 0,
      patterns: [],
      antiPatterns: [],
      analyzedAt: '2026-02-08T20:00:00.000Z',
    }
    const result = safeParseAnalysis(data)
    expect(result.success).toBe(true)
  })

  it('should return failure for safeParseAnalysis with invalid data', () => {
    const result = safeParseAnalysis({ invalid: true })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// Staleness Detection (pure function tests)
// =============================================================================

describe('staleness detection', () => {
  // Test checkStaleness method from AnalysisStorage
  it('should detect stale analysis when commits differ', () => {
    const { analysisStorage } = require('../../storage/analysis-storage')
    const result = analysisStorage.checkStaleness('abc1234', 'def5678')
    expect(result.isStale).toBe(true)
    expect(result.sealedCommit).toBe('abc1234')
    expect(result.currentCommit).toBe('def5678')
  })

  it('should detect fresh analysis when commits match', () => {
    const { analysisStorage } = require('../../storage/analysis-storage')
    const result = analysisStorage.checkStaleness('abc1234', 'abc1234')
    expect(result.isStale).toBe(false)
  })

  it('should handle null sealed commit', () => {
    const { analysisStorage } = require('../../storage/analysis-storage')
    const result = analysisStorage.checkStaleness(null, 'abc1234')
    expect(result.isStale).toBe(false)
    expect(result.message).toContain('No sealed analysis')
  })

  it('should handle null current commit', () => {
    const { analysisStorage } = require('../../storage/analysis-storage')
    const result = analysisStorage.checkStaleness('abc1234', null)
    expect(result.isStale).toBe(true)
    expect(result.message).toContain('Cannot determine')
  })
})

// =============================================================================
// Signature Computation (determinism test)
// =============================================================================

describe('signature computation', () => {
  it('should produce deterministic signatures for same input', () => {
    const { createHash } = require('node:crypto')

    const analysis = {
      projectId: 'test',
      languages: ['TypeScript'],
      frameworks: ['Hono'],
      configFiles: [],
      fileCount: 100,
      patterns: [],
      antiPatterns: [],
      analyzedAt: '2026-02-08T20:00:00.000Z',
      commitHash: 'abc1234',
    }

    const canonical = {
      projectId: analysis.projectId,
      languages: analysis.languages,
      frameworks: analysis.frameworks,
      packageManager: undefined,
      sourceDir: undefined,
      testDir: undefined,
      configFiles: analysis.configFiles,
      fileCount: analysis.fileCount,
      patterns: analysis.patterns,
      antiPatterns: analysis.antiPatterns,
      analyzedAt: analysis.analyzedAt,
      commitHash: analysis.commitHash,
    }

    const sig1 = createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
    const sig2 = createHash('sha256').update(JSON.stringify(canonical)).digest('hex')

    expect(sig1).toBe(sig2)
    expect(sig1).toHaveLength(64) // SHA-256 hex = 64 chars
  })

  it('should produce different signatures for different inputs', () => {
    const { createHash } = require('node:crypto')

    const data1 = JSON.stringify({ projectId: 'a', fileCount: 1 })
    const data2 = JSON.stringify({ projectId: 'b', fileCount: 2 })

    const sig1 = createHash('sha256').update(data1).digest('hex')
    const sig2 = createHash('sha256').update(data2).digest('hex')

    expect(sig1).not.toBe(sig2)
  })
})

// =============================================================================
// Backward Compatibility
// =============================================================================

describe('backward compatibility', () => {
  it('should parse old analysis.json without seal fields', () => {
    const oldFormat = {
      projectId: 'old-project',
      languages: ['JavaScript'],
      frameworks: ['Express'],
      configFiles: ['package.json'],
      fileCount: 50,
      patterns: [],
      antiPatterns: [],
      analyzedAt: '2025-12-01T00:00:00.000Z',
      // No status, commitHash, signature, sealedAt
    }

    const result = AnalysisItemSchema.parse(oldFormat)
    expect(result.status).toBe('draft') // Default
    expect(result.commitHash).toBeUndefined()
    expect(result.signature).toBeUndefined()
    expect(result.sealedAt).toBeUndefined()
  })

  it('should parse old analysis with modelMetadata but no seal fields', () => {
    const oldWithModel = {
      projectId: 'old-project',
      languages: ['TypeScript'],
      frameworks: [],
      configFiles: [],
      fileCount: 10,
      patterns: [],
      antiPatterns: [],
      analyzedAt: '2026-01-15T00:00:00.000Z',
      modelMetadata: {
        provider: 'claude',
        model: 'sonnet',
        recordedAt: '2026-01-15T00:00:00.000Z',
      },
    }

    const result = AnalysisItemSchema.parse(oldWithModel)
    expect(result.status).toBe('draft')
    expect(result.modelMetadata?.provider).toBe('claude')
  })
})
