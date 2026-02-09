/**
 * Analysis Injection Tests (PRJ-260)
 *
 * Tests for injecting sealed analysis data into task context:
 * - Prompt builder renders analysis in ground_truth section
 * - Anti-hallucination block enriched with analysis data
 * - Graceful degradation when no analysis available
 */

import { beforeEach, describe, expect, it } from 'bun:test'
import {
  buildAntiHallucinationBlock,
  type ProjectGroundTruth,
} from '../../agentic/anti-hallucination'
import promptBuilder from '../../agentic/prompt-builder'
import type { OrchestratorContext, SealedAnalysisContext } from '../../types'

// =============================================================================
// Test Fixtures
// =============================================================================

const mockSealedAnalysis: SealedAnalysisContext = {
  languages: ['TypeScript', 'JavaScript'],
  frameworks: ['Hono', 'Zod'],
  packageManager: 'bun',
  sourceDir: 'core/',
  testDir: 'core/__tests__/',
  fileCount: 295,
  patterns: [
    {
      name: 'StorageManager pattern',
      description: 'All storage uses StorageManager base class with read/write/update',
      location: 'core/storage/',
    },
    {
      name: 'Zod schemas',
      description: 'Runtime validation with Zod for all data structures',
    },
  ],
  antiPatterns: [
    {
      issue: 'Direct fs.writeFile without StorageManager',
      file: 'core/storage/legacy.ts',
      suggestion: 'Use StorageManager.write() instead',
    },
  ],
  status: 'sealed',
  commitHash: 'abc123def456',
}

function makeOrchestratorContext(
  sealedAnalysis: SealedAnalysisContext | null = mockSealedAnalysis
): OrchestratorContext {
  return {
    detectedDomains: ['backend', 'testing'],
    primaryDomain: 'backend',
    agents: [],
    skills: [],
    requiresFragmentation: false,
    subtasks: null,
    project: {
      id: 'test-project',
      ecosystem: 'TypeScript',
      conventions: ['Hono', 'Zod'],
    },
    sealedAnalysis,
  }
}

// =============================================================================
// Prompt Builder — Ground Truth Section
// =============================================================================

describe('Analysis Injection in Prompt Builder (PRJ-260)', () => {
  beforeEach(() => {
    promptBuilder.resetContext()
  })

  it('should render sealed analysis in ground truth section', async () => {
    const template = {
      frontmatter: { description: 'Test task' },
      content: '## Instructions\nDo the work',
    }
    const context = { projectPath: '/test/project', files: ['a.ts'] }
    const orcCtx = makeOrchestratorContext()

    const prompt = await promptBuilder.build(
      template,
      context,
      {},
      null,
      null,
      null,
      null,
      null,
      orcCtx
    )

    // Should contain analysis data
    expect(prompt).toContain('Languages**: TypeScript, JavaScript')
    expect(prompt).toContain('Frameworks**: Hono, Zod')
    expect(prompt).toContain('Package Manager**: bun')
    expect(prompt).toContain('Source Dir**: core/')
    expect(prompt).toContain('Test Dir**: core/__tests__/')
    expect(prompt).toContain('Files Analyzed**: 295')
    expect(prompt).toContain('Analysis Status**: sealed')
    expect(prompt).toContain('abc123de') // truncated commit hash
  })

  it('should render code patterns from sealed analysis', async () => {
    const template = {
      frontmatter: { description: 'Test' },
      content: '## Do',
    }
    const context = { projectPath: '/test', files: [] }
    const orcCtx = makeOrchestratorContext()

    const prompt = await promptBuilder.build(
      template,
      context,
      {},
      null,
      null,
      null,
      null,
      null,
      orcCtx
    )

    expect(prompt).toContain('Code Patterns (Follow These)')
    expect(prompt).toContain('StorageManager pattern')
    expect(prompt).toContain('All storage uses StorageManager base class')
    expect(prompt).toContain('core/storage/')
    expect(prompt).toContain('Zod schemas')
  })

  it('should render anti-patterns from sealed analysis', async () => {
    const template = {
      frontmatter: { description: 'Test' },
      content: '## Do',
    }
    const context = { projectPath: '/test', files: [] }
    const orcCtx = makeOrchestratorContext()

    const prompt = await promptBuilder.build(
      template,
      context,
      {},
      null,
      null,
      null,
      null,
      null,
      orcCtx
    )

    expect(prompt).toContain('Anti-Patterns (Avoid These)')
    expect(prompt).toContain('Direct fs.writeFile without StorageManager')
    expect(prompt).toContain('core/storage/legacy.ts')
    expect(prompt).toContain('Use StorageManager.write() instead')
  })

  it('should gracefully handle null sealed analysis', async () => {
    const template = {
      frontmatter: { description: 'Test' },
      content: '## Do',
    }
    const context = { projectPath: '/test', files: [] }
    const orcCtx = makeOrchestratorContext(null)

    const prompt = await promptBuilder.build(
      template,
      context,
      {},
      null,
      null,
      null,
      null,
      null,
      orcCtx
    )

    // Should still have basic project analysis
    expect(prompt).toContain('PROJECT ANALYSIS')
    expect(prompt).toContain('Ecosystem**: TypeScript')
    // Should NOT have analysis-specific fields
    expect(prompt).not.toContain('Languages**:')
    expect(prompt).not.toContain('Code Patterns (Follow These)')
    expect(prompt).not.toContain('Anti-Patterns (Avoid These)')
  })

  it('should handle empty patterns and anti-patterns', async () => {
    const template = {
      frontmatter: { description: 'Test' },
      content: '## Do',
    }
    const context = { projectPath: '/test', files: [] }
    const emptyAnalysis: SealedAnalysisContext = {
      ...mockSealedAnalysis,
      patterns: [],
      antiPatterns: [],
    }
    const orcCtx = makeOrchestratorContext(emptyAnalysis)

    const prompt = await promptBuilder.build(
      template,
      context,
      {},
      null,
      null,
      null,
      null,
      null,
      orcCtx
    )

    expect(prompt).toContain('Languages**: TypeScript, JavaScript')
    expect(prompt).not.toContain('Code Patterns (Follow These)')
    expect(prompt).not.toContain('Anti-Patterns (Avoid These)')
  })

  it('should handle no orchestrator context at all', async () => {
    const template = {
      frontmatter: { description: 'Test' },
      content: '## Do',
    }
    const context = { projectPath: '/test', files: [] }

    const prompt = await promptBuilder.build(
      template,
      context,
      {},
      null,
      null,
      null,
      null,
      null,
      null
    )

    // Should not crash, should have fallback rules
    expect(prompt).toContain('CONSTRAINTS')
    expect(prompt).not.toContain('PROJECT ANALYSIS')
  })
})

// =============================================================================
// Anti-Hallucination Block — Analysis Enrichment
// =============================================================================

describe('Anti-Hallucination Block with Analysis (PRJ-260)', () => {
  it('should include analysis languages in AVAILABLE list', () => {
    const truth: ProjectGroundTruth = {
      projectPath: '/test',
      language: 'TypeScript',
      techStack: ['Hono'],
      analysisLanguages: ['TypeScript', 'JavaScript', 'Shell'],
      analysisFrameworks: ['Hono', 'Vitest'],
    }

    const block = buildAntiHallucinationBlock(truth)

    expect(block).toContain('AVAILABLE in this project:')
    // TypeScript and Hono should not be duplicated
    expect(block).toContain('JavaScript')
    expect(block).toContain('Shell')
    expect(block).toContain('Vitest')
  })

  it('should deduplicate analysis data with existing tech stack (case-insensitive)', () => {
    const truth: ProjectGroundTruth = {
      projectPath: '/test',
      language: 'TypeScript',
      framework: 'Hono',
      techStack: ['Zod'],
      analysisLanguages: ['typescript'], // lowercase duplicate
      analysisFrameworks: ['hono', 'Zod'], // lowercase duplicates
    }

    const block = buildAntiHallucinationBlock(truth)

    // Count occurrences — each should appear exactly once
    const typescriptMatches = block.match(/typescript/gi)
    expect(typescriptMatches?.length).toBe(1)

    const honoMatches = block.match(/hono/gi)
    expect(honoMatches?.length).toBe(1)
  })

  it('should show package manager from analysis', () => {
    const truth: ProjectGroundTruth = {
      projectPath: '/test',
      analysisPackageManager: 'bun',
    }

    const block = buildAntiHallucinationBlock(truth)

    expect(block).toContain('PACKAGE MANAGER: bun')
  })

  it('should work without any analysis data', () => {
    const truth: ProjectGroundTruth = {
      projectPath: '/test',
      language: 'Python',
    }

    const block = buildAntiHallucinationBlock(truth)

    expect(block).toContain('AVAILABLE in this project: Python')
    expect(block).not.toContain('PACKAGE MANAGER:')
  })

  it('should handle empty analysis arrays gracefully', () => {
    const truth: ProjectGroundTruth = {
      projectPath: '/test',
      analysisLanguages: [],
      analysisFrameworks: [],
    }

    const block = buildAntiHallucinationBlock(truth)

    // Should not contain AVAILABLE line (no tech to show)
    expect(block).not.toContain('AVAILABLE in this project:')
    expect(block).toContain('CONSTRAINTS')
  })
})

// =============================================================================
// SealedAnalysisContext Type
// =============================================================================

describe('SealedAnalysisContext type (PRJ-260)', () => {
  it('should accept valid sealed analysis data', () => {
    const analysis: SealedAnalysisContext = {
      languages: ['TypeScript'],
      frameworks: ['Hono'],
      fileCount: 100,
      patterns: [{ name: 'test', description: 'test pattern' }],
      antiPatterns: [{ issue: 'test', file: 'test.ts', suggestion: 'fix it' }],
      status: 'sealed',
    }

    expect(analysis.languages).toEqual(['TypeScript'])
    expect(analysis.status).toBe('sealed')
  })

  it('should accept draft status', () => {
    const analysis: SealedAnalysisContext = {
      languages: [],
      frameworks: [],
      fileCount: 0,
      patterns: [],
      antiPatterns: [],
      status: 'draft',
    }

    expect(analysis.status).toBe('draft')
  })

  it('should accept optional fields', () => {
    const analysis: SealedAnalysisContext = {
      languages: ['Python'],
      frameworks: [],
      fileCount: 50,
      patterns: [],
      antiPatterns: [],
      status: 'sealed',
      packageManager: 'pip',
      sourceDir: 'src/',
      testDir: 'tests/',
      commitHash: 'abc123',
    }

    expect(analysis.packageManager).toBe('pip')
    expect(analysis.commitHash).toBe('abc123')
  })
})
