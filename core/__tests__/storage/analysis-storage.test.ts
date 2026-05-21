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
  type SemanticCheckResult,
  safeParseAnalysis,
} from '../../schemas/analysis'

// Schema Validation

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

// Staleness Detection (pure function tests)

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

// Signature Computation (determinism test)

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

// Backward Compatibility

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

// Semantic Verification (PRJ-270)

describe('semantic verification', () => {
  const { semanticVerify } = require('../../schemas/analysis')
  const fs = require('node:fs/promises')
  const path = require('node:path')
  const os = require('node:os')

  // Helper to create a temporary test project
  async function createTestProject(options: {
    hasPackageJson?: boolean
    packageJsonDeps?: Record<string, string>
    files?: { path: string; content: string }[]
    fileCount?: number
  }) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-test-'))

    // Create package.json if requested
    if (options.hasPackageJson) {
      const pkg = {
        name: 'test-project',
        dependencies: options.packageJsonDeps || {},
      }
      await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(pkg, null, 2))
    }

    // Create additional files
    if (options.files) {
      for (const file of options.files) {
        const filePath = path.join(tmpDir, file.path)
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, file.content)
      }
    }

    return tmpDir
  }

  // Helper to cleanup test project
  async function cleanupTestProject(tmpDir: string) {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }

  it('should pass all checks for valid analysis', async () => {
    const projectPath = await createTestProject({
      hasPackageJson: true,
      packageJsonDeps: { hono: '^3.0.0', zod: '^3.0.0' },
      files: [
        { path: 'src/index.ts', content: 'export const app = {}' },
        { path: 'src/server.ts', content: 'import { serve } from "bun"' },
        { path: 'patterns/service.ts', content: 'export class UserService {}' },
      ],
    })

    const analysis = {
      projectId: 'test',
      languages: ['TypeScript'],
      frameworks: ['Hono'],
      configFiles: [],
      fileCount: 4, // package.json + 3 TypeScript files
      patterns: [
        { name: 'Service pattern', description: 'DI pattern', location: 'patterns/service.ts' },
      ],
      antiPatterns: [],
      analyzedAt: '2026-02-10T00:00:00.000Z',
      status: 'draft' as const,
    }

    const result = await semanticVerify(analysis, projectPath)

    expect(result.passed).toBe(true)
    expect(result.failedCount).toBe(0)
    expect(result.passedCount).toBeGreaterThan(0)
    expect(result.checks.every((c: SemanticCheckResult) => c.passed)).toBe(true)

    await cleanupTestProject(projectPath)
  })

  it('should fail when frameworks are not in package.json', async () => {
    const projectPath = await createTestProject({
      hasPackageJson: true,
      packageJsonDeps: { express: '^4.0.0' }, // Different framework
      files: [{ path: 'src/index.ts', content: '' }],
    })

    const analysis = {
      projectId: 'test',
      languages: ['TypeScript'],
      frameworks: ['Hono', 'Zod'], // These are not in dependencies
      configFiles: [],
      fileCount: 1,
      patterns: [],
      antiPatterns: [],
      analyzedAt: '2026-02-10T00:00:00.000Z',
      status: 'draft' as const,
    }

    const result = await semanticVerify(analysis, projectPath)

    expect(result.passed).toBe(false)
    expect(result.failedCount).toBeGreaterThan(0)

    const frameworkCheck = result.checks.find(
      (c: SemanticCheckResult) => c.name === 'Framework verification'
    )
    expect(frameworkCheck?.passed).toBe(false)
    expect(frameworkCheck?.error).toContain('not found in dependencies')

    await cleanupTestProject(projectPath)
  })

  it('should fail when package.json is missing', async () => {
    const projectPath = await createTestProject({
      hasPackageJson: false, // No package.json
      files: [{ path: 'src/index.ts', content: '' }],
    })

    const analysis = {
      projectId: 'test',
      languages: ['TypeScript'],
      frameworks: ['Hono'],
      configFiles: [],
      fileCount: 1,
      patterns: [],
      antiPatterns: [],
      analyzedAt: '2026-02-10T00:00:00.000Z',
      status: 'draft' as const,
    }

    const result = await semanticVerify(analysis, projectPath)

    const frameworkCheck = result.checks.find(
      (c: SemanticCheckResult) => c.name === 'Framework verification'
    )
    expect(frameworkCheck?.passed).toBe(false)
    expect(frameworkCheck?.error).toContain('package.json not found')

    await cleanupTestProject(projectPath)
  })

  it('should fail when declared languages have no matching files', async () => {
    const projectPath = await createTestProject({
      hasPackageJson: true,
      files: [
        { path: 'src/index.js', content: '' }, // Only JS files
      ],
    })

    const analysis = {
      projectId: 'test',
      languages: ['TypeScript', 'Go'], // Declared but no .ts or .go files
      frameworks: [],
      configFiles: [],
      fileCount: 1,
      patterns: [],
      antiPatterns: [],
      analyzedAt: '2026-02-10T00:00:00.000Z',
      status: 'draft' as const,
    }

    const result = await semanticVerify(analysis, projectPath)

    const languageCheck = result.checks.find(
      (c: SemanticCheckResult) => c.name === 'Language verification'
    )
    expect(languageCheck?.passed).toBe(false)
    expect(languageCheck?.error).toContain('without matching files')

    await cleanupTestProject(projectPath)
  })

  it('should fail when pattern locations reference missing files', async () => {
    const projectPath = await createTestProject({
      hasPackageJson: true,
      files: [{ path: 'src/index.ts', content: '' }],
    })

    const analysis = {
      projectId: 'test',
      languages: ['TypeScript'],
      frameworks: [],
      configFiles: [],
      fileCount: 1,
      patterns: [
        { name: 'Service pattern', description: 'DI', location: 'src/service.ts' }, // Doesn't exist
        { name: 'Repository', description: 'Data access', location: 'src/repo.ts' }, // Doesn't exist
      ],
      antiPatterns: [],
      analyzedAt: '2026-02-10T00:00:00.000Z',
      status: 'draft' as const,
    }

    const result = await semanticVerify(analysis, projectPath)

    const patternCheck = result.checks.find(
      (c: SemanticCheckResult) => c.name === 'Pattern location verification'
    )
    expect(patternCheck?.passed).toBe(false)
    expect(patternCheck?.error).toContain('not found')

    await cleanupTestProject(projectPath)
  })

  it('should fail when file count is inaccurate', async () => {
    const projectPath = await createTestProject({
      hasPackageJson: true,
      files: [
        { path: 'src/a.ts', content: '' },
        { path: 'src/b.ts', content: '' },
        { path: 'src/c.ts', content: '' },
      ], // 4 files total (package.json + 3 .ts files)
    })

    const analysis = {
      projectId: 'test',
      languages: ['TypeScript'],
      frameworks: [],
      configFiles: [],
      fileCount: 100, // Way off (actual is ~4)
      patterns: [],
      antiPatterns: [],
      analyzedAt: '2026-02-10T00:00:00.000Z',
      status: 'draft' as const,
    }

    const result = await semanticVerify(analysis, projectPath)

    const fileCountCheck = result.checks.find(
      (c: SemanticCheckResult) => c.name === 'File count verification'
    )
    expect(fileCountCheck?.passed).toBe(false)
    expect(fileCountCheck?.error).toContain('mismatch')

    await cleanupTestProject(projectPath)
  })

  it('should fail when anti-pattern files are missing', async () => {
    const projectPath = await createTestProject({
      hasPackageJson: true,
      files: [{ path: 'src/index.ts', content: '' }],
    })

    const analysis = {
      projectId: 'test',
      languages: ['TypeScript'],
      frameworks: [],
      configFiles: [],
      fileCount: 1,
      patterns: [],
      antiPatterns: [
        { issue: 'Missing types', file: 'src/bad.ts', suggestion: 'Add types' }, // File doesn't exist
      ],
      analyzedAt: '2026-02-10T00:00:00.000Z',
      status: 'draft' as const,
    }

    const result = await semanticVerify(analysis, projectPath)

    const antiPatternCheck = result.checks.find(
      (c: SemanticCheckResult) => c.name === 'Anti-pattern file verification'
    )
    expect(antiPatternCheck?.passed).toBe(false)
    expect(antiPatternCheck?.error).toContain('not found')

    await cleanupTestProject(projectPath)
  })

  it('should skip checks when no data to verify', async () => {
    const projectPath = await createTestProject({
      hasPackageJson: true,
    })

    const analysis = {
      projectId: 'test',
      languages: [], // No languages declared
      frameworks: [], // No frameworks declared
      configFiles: [],
      fileCount: 1,
      patterns: [], // No patterns with locations
      antiPatterns: [], // No anti-patterns
      analyzedAt: '2026-02-10T00:00:00.000Z',
      status: 'draft' as const,
    }

    const result = await semanticVerify(analysis, projectPath)

    expect(result.passed).toBe(true) // All checks skipped, so passes
    expect(
      result.checks.every((c: SemanticCheckResult) => c.output?.includes('skipped') || c.passed)
    ).toBe(true)

    await cleanupTestProject(projectPath)
  })

  it('should accept file count within tolerance (10%)', async () => {
    const projectPath = await createTestProject({
      hasPackageJson: true,
      files: [
        { path: 'src/a.ts', content: '' },
        { path: 'src/b.ts', content: '' },
        { path: 'src/c.ts', content: '' },
        { path: 'src/d.ts', content: '' },
        { path: 'src/e.ts', content: '' },
      ], // 6 files total
    })

    const analysis = {
      projectId: 'test',
      languages: ['TypeScript'],
      frameworks: [],
      configFiles: [],
      fileCount: 6, // Within 10% tolerance
      patterns: [],
      antiPatterns: [],
      analyzedAt: '2026-02-10T00:00:00.000Z',
      status: 'draft' as const,
    }

    const result = await semanticVerify(analysis, projectPath)

    const fileCountCheck = result.checks.find(
      (c: SemanticCheckResult) => c.name === 'File count verification'
    )
    expect(fileCountCheck?.passed).toBe(true)

    await cleanupTestProject(projectPath)
  })

  it('should handle partial framework matches (case insensitive)', async () => {
    const projectPath = await createTestProject({
      hasPackageJson: true,
      packageJsonDeps: { '@hono/node-server': '^1.0.0' }, // Hono as part of package name
    })

    const analysis = {
      projectId: 'test',
      languages: [],
      frameworks: ['Hono'], // Should match @hono/node-server
      configFiles: [],
      fileCount: 1,
      patterns: [],
      antiPatterns: [],
      analyzedAt: '2026-02-10T00:00:00.000Z',
      status: 'draft' as const,
    }

    const result = await semanticVerify(analysis, projectPath)

    const frameworkCheck = result.checks.find(
      (c: SemanticCheckResult) => c.name === 'Framework verification'
    )
    expect(frameworkCheck?.passed).toBe(true)

    await cleanupTestProject(projectPath)
  })
})
