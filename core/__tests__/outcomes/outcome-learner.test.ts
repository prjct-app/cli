/**
 * Outcome Memory Learner Tests (PRJ-283)
 *
 * Tests for the outcome-to-memory auto-learning system:
 * - File co-change pattern extraction
 * - Tech stack pattern extraction
 * - Architecture pattern extraction
 * - Gotcha pattern extraction
 * - Outcome pattern extraction
 * - Confidence threshold (3+ occurrences)
 * - Memory injection (create/update)
 * - Auto-learned tagging
 * - Combined learning results
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { SemanticMemories } from '../../agentic/semantic-memories'
import pathManager from '../../infrastructure/path-manager'
import type { FeatureOutcome } from '../../schemas/outcomes'
import type { TaskHistoryEntry } from '../../schemas/state'
import { OutcomeMemoryLearner } from '../../workflows/outcome-learner'

// =============================================================================
// Test Setup
// =============================================================================

let tmpRoot: string | null = null
let testProjectId: string
let learner: OutcomeMemoryLearner
let semanticMemories: SemanticMemories

const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-learner-test-'))
  testProjectId = `test-learner-${Date.now()}`

  pathManager.getGlobalProjectPath = (projectId: string) => {
    return path.join(tmpRoot!, projectId)
  }

  // Create memory directory
  const memoryPath = path.join(tmpRoot!, testProjectId, 'memory')
  await fs.mkdir(memoryPath, { recursive: true })

  learner = new OutcomeMemoryLearner()
  semanticMemories = new SemanticMemories()
})

afterEach(async () => {
  pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
  semanticMemories.reset()

  if (tmpRoot) {
    await fs.rm(tmpRoot, { recursive: true, force: true })
    tmpRoot = null
  }
})

// =============================================================================
// Helpers
// =============================================================================

function createTaskHistory(overrides: Partial<TaskHistoryEntry> = {}): TaskHistoryEntry {
  return {
    taskId: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: 'Test task',
    classification: 'feature',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    subtaskCount: 1,
    subtaskSummaries: [],
    outcome: 'Test outcome',
    branchName: 'feature/test',
    ...overrides,
  } as TaskHistoryEntry
}

function createOutcome(overrides: Partial<FeatureOutcome> = {}): FeatureOutcome {
  return {
    id: `out_feat_${Date.now()}`,
    featureId: `feat-${Date.now()}`,
    featureName: 'Test Feature',
    prdId: null,
    effort: {
      estimated: { hours: 2, confidence: 'medium' as const, source: 'manual' as const },
      actual: { hours: 2.5 },
      variance: { hours: 0.5, percentage: 25 },
    },
    learnings: {
      whatWorked: [],
      whatDidnt: [],
      surprises: [],
      recommendations: [],
    },
    roi: {
      valueDelivered: 5,
      userImpact: 'medium' as const,
      businessImpact: 'medium' as const,
      roiScore: 20,
      worthIt: 'probably' as const,
    },
    rating: 3 as const,
    startedAt: new Date().toISOString(),
    shippedAt: new Date().toISOString(),
    ...overrides,
  } as FeatureOutcome
}

// =============================================================================
// File Co-change Pattern Extraction
// =============================================================================

describe('File Co-change Patterns', () => {
  it('extracts file pairs that change together across tasks', () => {
    const history = [
      createTaskHistory({
        subtaskSummaries: [
          {
            title: 'Sub 1',
            description: 'Modified schema and storage',
            filesChanged: [
              { path: 'core/schemas/state.ts', action: 'modified' },
              { path: 'core/storage/state-storage.ts', action: 'modified' },
            ],
            whatWasDone: ['Updated schema'],
            outputForNextAgent: 'Done',
          },
        ],
      }),
      createTaskHistory({
        subtaskSummaries: [
          {
            title: 'Sub 2',
            description: 'Modified schema and storage again',
            filesChanged: [
              { path: 'core/schemas/state.ts', action: 'modified' },
              { path: 'core/storage/state-storage.ts', action: 'modified' },
            ],
            whatWasDone: ['Updated more'],
            outputForNextAgent: 'Done',
          },
        ],
      }),
    ]

    const patterns = learner.extractFileCochangePatterns(history)

    expect(patterns.length).toBe(1)
    expect(patterns[0].pattern).toContain('core/schemas/state.ts')
    expect(patterns[0].pattern).toContain('core/storage/state-storage.ts')
    expect(patterns[0].occurrences).toBe(2)
    expect(patterns[0].category).toBe('file_cochange')
  })

  it('ignores pairs that only co-change once', () => {
    const history = [
      createTaskHistory({
        subtaskSummaries: [
          {
            title: 'Sub 1',
            description: 'Unique change',
            filesChanged: [
              { path: 'a.ts', action: 'modified' },
              { path: 'b.ts', action: 'modified' },
            ],
            whatWasDone: ['Changed'],
            outputForNextAgent: 'Done',
          },
        ],
      }),
    ]

    const patterns = learner.extractFileCochangePatterns(history)
    expect(patterns.length).toBe(0)
  })

  it('handles tasks with no subtask summaries', () => {
    const history = [createTaskHistory({ subtaskSummaries: [] })]
    const patterns = learner.extractFileCochangePatterns(history)
    expect(patterns.length).toBe(0)
  })

  it('handles subtasks with no filesChanged', () => {
    const history = [
      createTaskHistory({
        subtaskSummaries: [
          {
            title: 'Sub 1',
            description: 'No files',
            filesChanged: [],
            whatWasDone: ['Stuff'],
            outputForNextAgent: 'Done',
          },
        ],
      }),
    ]

    const patterns = learner.extractFileCochangePatterns(history)
    expect(patterns.length).toBe(0)
  })

  it('sorts by occurrences descending', () => {
    const history = [
      createTaskHistory({
        subtaskSummaries: [
          {
            title: 'Sub 1',
            description: 'Changed a+b',
            filesChanged: [
              { path: 'a.ts', action: 'modified' },
              { path: 'b.ts', action: 'modified' },
              { path: 'c.ts', action: 'modified' },
            ],
            whatWasDone: ['Changed'],
            outputForNextAgent: 'Done',
          },
        ],
      }),
      createTaskHistory({
        subtaskSummaries: [
          {
            title: 'Sub 2',
            description: 'Changed a+b+c again',
            filesChanged: [
              { path: 'a.ts', action: 'modified' },
              { path: 'b.ts', action: 'modified' },
              { path: 'c.ts', action: 'modified' },
            ],
            whatWasDone: ['Changed'],
            outputForNextAgent: 'Done',
          },
        ],
      }),
      createTaskHistory({
        subtaskSummaries: [
          {
            title: 'Sub 3',
            description: 'Changed a+c only',
            filesChanged: [
              { path: 'a.ts', action: 'modified' },
              { path: 'c.ts', action: 'modified' },
            ],
            whatWasDone: ['Changed'],
            outputForNextAgent: 'Done',
          },
        ],
      }),
    ]

    const patterns = learner.extractFileCochangePatterns(history)
    // a+c = 3 occurrences, a+b = 2, b+c = 2
    expect(patterns[0].occurrences).toBeGreaterThanOrEqual(
      patterns[patterns.length - 1].occurrences
    )
  })
})

// =============================================================================
// Stack Pattern Extraction
// =============================================================================

describe('Stack Patterns', () => {
  it('extracts confirmed stack from feedback', () => {
    const history = [
      createTaskHistory({
        feedback: {
          stackConfirmed: ['TypeScript', 'Bun'],
          patternsDiscovered: [],
          agentAccuracy: [],
          issuesEncountered: [],
        },
      }),
      createTaskHistory({
        feedback: {
          stackConfirmed: ['TypeScript'],
          patternsDiscovered: [],
          agentAccuracy: [],
          issuesEncountered: [],
        },
      }),
    ]

    const patterns = learner.extractStackPatterns(history)

    const tsPattern = patterns.find((p) => p.pattern.includes('TypeScript'))
    expect(tsPattern).toBeDefined()
    expect(tsPattern!.occurrences).toBe(2)
    expect(tsPattern!.category).toBe('tech_stack')
  })

  it('handles tasks without feedback', () => {
    const history = [createTaskHistory()]
    const patterns = learner.extractStackPatterns(history)
    expect(patterns.length).toBe(0)
  })
})

// =============================================================================
// Architecture Pattern Extraction
// =============================================================================

describe('Architecture Patterns', () => {
  it('extracts discovered patterns from feedback', () => {
    const pattern = 'Write-Through pattern: JSON → MD → Event'
    const history = [
      createTaskHistory({
        feedback: {
          stackConfirmed: [],
          patternsDiscovered: [pattern],
          agentAccuracy: [],
          issuesEncountered: [],
        },
      }),
      createTaskHistory({
        feedback: {
          stackConfirmed: [],
          patternsDiscovered: [pattern],
          agentAccuracy: [],
          issuesEncountered: [],
        },
      }),
    ]

    const patterns = learner.extractArchitecturePatterns(history)
    expect(patterns.length).toBe(1)
    expect(patterns[0].pattern).toBe(pattern)
    expect(patterns[0].occurrences).toBe(2)
    expect(patterns[0].category).toBe('architecture')
  })
})

// =============================================================================
// Gotcha Pattern Extraction
// =============================================================================

describe('Gotcha Patterns', () => {
  it('promotes issues with 2+ occurrences to gotchas', () => {
    const issue = 'SyncService duplicates AgentGenerator logic'
    const history = [
      createTaskHistory({
        feedback: {
          stackConfirmed: [],
          patternsDiscovered: [],
          agentAccuracy: [],
          issuesEncountered: [issue],
        },
      }),
      createTaskHistory({
        feedback: {
          stackConfirmed: [],
          patternsDiscovered: [],
          agentAccuracy: [],
          issuesEncountered: [issue],
        },
      }),
    ]

    const patterns = learner.extractGotchaPatterns(history)
    expect(patterns.length).toBe(1)
    expect(patterns[0].pattern).toContain(issue)
    expect(patterns[0].category).toBe('gotcha')
  })

  it('excludes single-occurrence issues', () => {
    const history = [
      createTaskHistory({
        feedback: {
          stackConfirmed: [],
          patternsDiscovered: [],
          agentAccuracy: [],
          issuesEncountered: ['One-time issue'],
        },
      }),
    ]

    const patterns = learner.extractGotchaPatterns(history)
    expect(patterns.length).toBe(0)
  })
})

// =============================================================================
// Outcome Pattern Extraction
// =============================================================================

describe('Outcome Patterns', () => {
  it('extracts recurring whatWorked learnings', () => {
    const outcomes = [
      createOutcome({
        learnings: {
          whatWorked: ['Write tests first'],
          whatDidnt: [],
          surprises: [],
          recommendations: [],
        },
      }),
      createOutcome({
        learnings: {
          whatWorked: ['Write tests first'],
          whatDidnt: [],
          surprises: [],
          recommendations: [],
        },
      }),
    ]

    const patterns = learner.extractOutcomePatterns(outcomes)
    const workPattern = patterns.find((p) => p.pattern.includes('Write tests first'))
    expect(workPattern).toBeDefined()
    expect(workPattern!.occurrences).toBe(2)
    expect(workPattern!.category).toBe('workflow')
  })

  it('extracts recurring whatDidnt learnings as gotchas', () => {
    const outcomes = [
      createOutcome({
        learnings: {
          whatWorked: [],
          whatDidnt: ['Skipping linting'],
          surprises: [],
          recommendations: [],
        },
      }),
      createOutcome({
        learnings: {
          whatWorked: [],
          whatDidnt: ['Skipping linting'],
          surprises: [],
          recommendations: [],
        },
      }),
    ]

    const patterns = learner.extractOutcomePatterns(outcomes)
    const issue = patterns.find((p) => p.pattern.includes('Skipping linting'))
    expect(issue).toBeDefined()
    expect(issue!.category).toBe('gotcha')
  })

  it('detects estimation underestimation pattern', () => {
    const outcomes = Array.from({ length: 4 }, () =>
      createOutcome({
        effort: {
          estimated: { hours: 2 },
          actual: { hours: 4 },
          variance: { hours: 2, percentage: 100 },
        },
      })
    )

    const patterns = learner.extractOutcomePatterns(outcomes)
    const estimationPattern = patterns.find((p) => p.category === 'estimation')
    expect(estimationPattern).toBeDefined()
    expect(estimationPattern!.pattern).toContain('underestimated')
  })
})

// =============================================================================
// Confidence Threshold
// =============================================================================

describe('Confidence Threshold', () => {
  it('only injects patterns with 3+ occurrences', async () => {
    // Create 3 tasks with same stack confirmation
    const history = Array.from({ length: 3 }, () =>
      createTaskHistory({
        feedback: {
          stackConfirmed: ['TypeScript'],
          patternsDiscovered: [],
          agentAccuracy: [],
          issuesEncountered: [],
        },
      })
    )

    const result = await learner.learnFromTaskHistory(testProjectId, history, semanticMemories)

    expect(result.patternsQualified).toBeGreaterThanOrEqual(1)
    expect(result.memoriesInjected).toBeGreaterThanOrEqual(1)
  })

  it('skips patterns below threshold', async () => {
    // Only 2 occurrences - below threshold
    const history = Array.from({ length: 2 }, () =>
      createTaskHistory({
        feedback: {
          stackConfirmed: ['Rare-Stack'],
          patternsDiscovered: [],
          agentAccuracy: [],
          issuesEncountered: [],
        },
      })
    )

    const result = await learner.learnFromTaskHistory(testProjectId, history, semanticMemories)

    // 2 occurrences is below threshold of 3
    const rareStackSkipped = result.details.find(
      (d) => d.pattern.includes('Rare-Stack') && d.action === 'skipped'
    )
    expect(rareStackSkipped).toBeDefined()
  })
})

// =============================================================================
// Memory Injection
// =============================================================================

describe('Memory Injection', () => {
  it('creates new auto-learned memory', async () => {
    const history = Array.from({ length: 3 }, () =>
      createTaskHistory({
        feedback: {
          stackConfirmed: ['TypeScript'],
          patternsDiscovered: [],
          agentAccuracy: [],
          issuesEncountered: [],
        },
      })
    )

    await learner.learnFromTaskHistory(testProjectId, history, semanticMemories)

    const memories = await semanticMemories.getAllMemories(testProjectId)
    const autoLearned = memories.filter((m) => m.title.startsWith('[auto-learned]'))
    expect(autoLearned.length).toBeGreaterThanOrEqual(1)
  })

  it('tags auto-learned memories with source: auto-learned', async () => {
    const history = Array.from({ length: 3 }, () =>
      createTaskHistory({
        feedback: {
          stackConfirmed: ['TypeScript'],
          patternsDiscovered: [],
          agentAccuracy: [],
          issuesEncountered: [],
        },
      })
    )

    await learner.learnFromTaskHistory(testProjectId, history, semanticMemories)

    const memories = await semanticMemories.getAllMemories(testProjectId)
    const autoLearned = memories.filter((m) => m.title.startsWith('[auto-learned]'))
    for (const memory of autoLearned) {
      expect(memory.content).toContain('source: auto-learned')
    }
  })

  it('updates existing auto-learned memory instead of duplicating', async () => {
    const history = Array.from({ length: 3 }, () =>
      createTaskHistory({
        feedback: {
          stackConfirmed: ['TypeScript'],
          patternsDiscovered: [],
          agentAccuracy: [],
          issuesEncountered: [],
        },
      })
    )

    // First learning pass
    await learner.learnFromTaskHistory(testProjectId, history, semanticMemories)
    const firstCount = (await semanticMemories.getAllMemories(testProjectId)).length

    // Second learning pass (should update, not duplicate)
    semanticMemories.reset()
    await learner.learnFromTaskHistory(testProjectId, history, semanticMemories)
    const secondCount = (await semanticMemories.getAllMemories(testProjectId)).length

    expect(secondCount).toBe(firstCount)
  })

  it('assigns correct tags based on pattern category', async () => {
    const history = Array.from({ length: 3 }, () =>
      createTaskHistory({
        feedback: {
          stackConfirmed: ['TypeScript'],
          patternsDiscovered: [],
          agentAccuracy: [],
          issuesEncountered: [],
        },
      })
    )

    await learner.learnFromTaskHistory(testProjectId, history, semanticMemories)

    const memories = await semanticMemories.getAllMemories(testProjectId)
    const stackMemory = memories.find(
      (m) => m.title.startsWith('[auto-learned]') && m.content.includes('TypeScript')
    )

    if (stackMemory) {
      expect(stackMemory.tags).toContain('tech_stack')
    }
  })
})

// =============================================================================
// Empty / Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  it('handles empty task history', async () => {
    const result = await learner.learnFromTaskHistory(testProjectId, [], semanticMemories)

    expect(result.patternsExtracted).toBe(0)
    expect(result.memoriesInjected).toBe(0)
  })

  it('handles empty outcomes', async () => {
    const result = await learner.learnFromOutcomes(testProjectId, [], semanticMemories)

    expect(result.patternsExtracted).toBe(0)
    expect(result.memoriesInjected).toBe(0)
  })

  it('handles tasks with null/missing feedback fields', () => {
    const history = [
      createTaskHistory({
        feedback: {},
      }),
    ]

    // Should not throw
    const stackPatterns = learner.extractStackPatterns(history)
    const archPatterns = learner.extractArchitecturePatterns(history)
    const gotchaPatterns = learner.extractGotchaPatterns(history)

    expect(stackPatterns.length).toBe(0)
    expect(archPatterns.length).toBe(0)
    expect(gotchaPatterns.length).toBe(0)
  })
})

// =============================================================================
// getAllPatterns
// =============================================================================

describe('getAllPatterns', () => {
  it('combines all pattern types sorted by occurrences', () => {
    const history = Array.from({ length: 3 }, () =>
      createTaskHistory({
        subtaskSummaries: [
          {
            title: 'Sub',
            description: 'Changed files',
            filesChanged: [
              { path: 'schema.ts', action: 'modified' },
              { path: 'storage.ts', action: 'modified' },
            ],
            whatWasDone: ['Changed'],
            outputForNextAgent: 'Done',
          },
        ],
        feedback: {
          stackConfirmed: ['TypeScript'],
          patternsDiscovered: ['Pattern A'],
          agentAccuracy: [],
          issuesEncountered: ['Issue X'],
        },
      })
    )

    const allPatterns = learner.getAllPatterns(history)
    expect(allPatterns.length).toBeGreaterThan(0)

    // Verify sorting
    for (let i = 1; i < allPatterns.length; i++) {
      expect(allPatterns[i - 1].occurrences).toBeGreaterThanOrEqual(allPatterns[i].occurrences)
    }
  })

  it('includes outcome patterns when provided', () => {
    const outcomes = Array.from({ length: 3 }, () =>
      createOutcome({
        learnings: {
          whatWorked: ['Use Zod schemas'],
          whatDidnt: [],
          surprises: [],
          recommendations: [],
        },
      })
    )

    const allPatterns = learner.getAllPatterns([], outcomes)
    const zodPattern = allPatterns.find((p) => p.pattern.includes('Zod schemas'))
    expect(zodPattern).toBeDefined()
  })
})

// =============================================================================
// LearningResult Details
// =============================================================================

describe('LearningResult details', () => {
  it('reports correct action for each pattern', async () => {
    const history = Array.from({ length: 3 }, () =>
      createTaskHistory({
        feedback: {
          stackConfirmed: ['TypeScript'],
          patternsDiscovered: ['Known pattern'],
          agentAccuracy: [],
          issuesEncountered: [],
        },
      })
    )

    const result = await learner.learnFromTaskHistory(testProjectId, history, semanticMemories)

    // Should have details for all processed patterns
    expect(result.details.length).toBeGreaterThan(0)

    for (const detail of result.details) {
      expect(['created', 'updated', 'skipped']).toContain(detail.action)
      expect(detail.pattern).toBeTruthy()
      expect(detail.confidence).toBeTruthy()
    }
  })

  it('reports skip reason for below-threshold patterns', async () => {
    // Only 1 occurrence — will be below threshold
    const history = [
      createTaskHistory({
        feedback: {
          stackConfirmed: ['OnceOnly'],
          patternsDiscovered: [],
          agentAccuracy: [],
          issuesEncountered: [],
        },
      }),
    ]

    const result = await learner.learnFromTaskHistory(testProjectId, history, semanticMemories)

    const skipped = result.details.filter((d) => d.action === 'skipped')
    for (const detail of skipped) {
      expect(detail.reason).toBeDefined()
      expect(detail.reason).toContain('occurrences needed')
    }
  })
})
