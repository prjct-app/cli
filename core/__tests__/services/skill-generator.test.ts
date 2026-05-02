/**
 * Tests for the single anti-harness skill generator (alpha.11).
 *
 * v1 shipped 4 prescriptive skills (prjct-context, prjct-task,
 * prjct-ship, prjct-workflow) that told Claude WHAT to do step by
 * step. Alpha.11 collapses them into one `prjct` skill whose body
 * follows the canonical Anthropic shape: Use when / What's here /
 * Gotchas. Tests validate shape, not prescription.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  type ConditionContext,
  SKILL_DEFINITIONS,
  type SkillContext,
  SkillGenerator,
} from '../../services/skill-generator'
import type { ProjectSyncResult } from '../../types/project-sync'

function makeSyncResult(overrides: Partial<ProjectSyncResult> = {}): ProjectSyncResult {
  return {
    success: true,
    projectId: 'test-project-id',
    cliVersion: '2.0.0-alpha.11',
    git: {
      branch: 'feat/alpha11',
      commits: 100,
      contributors: 3,
      hasChanges: true,
      stagedFiles: [],
      modifiedFiles: [],
      untrackedFiles: [],
      recentCommits: [],
      weeklyCommits: 5,
    },
    stats: {
      fileCount: 200,
      version: '2.0.0',
      name: 'my-app',
      ecosystem: 'JavaScript',
      projectType: 'enterprise',
      languages: ['TypeScript'],
      frameworks: ['Hono'],
    },
    commands: {
      install: 'npm install',
      test: 'npm test',
      build: 'npm run build',
      dev: 'npm run dev',
      lint: 'npm run lint',
      format: 'npm run format',
    },
    stack: {
      hasFrontend: false,
      hasBackend: true,
      hasDatabase: true,
      hasDocker: false,
      hasTesting: true,
      frontendType: null,
      frameworks: ['Hono'],
    },
    ...overrides,
  }
}

function makeRichContext(): Partial<
  Omit<SkillContext, 'projectName' | 'stack' | 'branch' | 'commands' | 'projectId'>
> {
  return {
    version: '2.0.0',
    fileCount: 200,
    patterns: [
      {
        name: 'Storage Layer Abstraction',
        description: 'Consistent StorageManager base class',
        location: 'core/storage/',
      },
    ],
    antiPatterns: [
      {
        issue: 'Unbounded any type',
        file: 'multiple',
        suggestion: 'Use explicit types',
        severity: 'high',
      },
    ],
    recentShipped: [{ name: 'Static context removal', type: 'refactor', duration: '3h' }],
    velocity: { avgPoints: 21, trend: 'stable', accuracy: 78 },
    backlogCount: 5,
    completedTaskCount: 12,
    pausedTaskCount: 1,
    knownGotchas: ['SQLite WAL mode can cause locking in parallel tests'],
    hasActiveTask: true,
    activeTaskDescription: 'Wire alpha.11 hooks',
    pausedTasks: [],
    topBacklog: [{ description: 'Add webhook support', priority: 'high' }],
    ideasCount: 7,
    shippedCount: 15,
    userPatterns: ['Always uses bun instead of npm'],
  }
}

function makeConditionContext(overrides: Partial<ConditionContext> = {}): ConditionContext {
  return {
    backlogCount: 0,
    completedTaskCount: 0,
    pausedTaskCount: 0,
    hasActiveTask: false,
    ...overrides,
  }
}

describe('GLOBAL_CLAUDE_MD_CONTENT (command-installer)', () => {
  it('does not contain authoritarian instructions or dead references', async () => {
    const src = await fs.readFile(
      path.join(__dirname, '../../infrastructure/command-installer.ts'),
      'utf-8'
    )
    expect(src).not.toContain('MANDATORY')
    expect(src).not.toContain('NEVER end a session')
    expect(src).not.toContain('Context7 MCP is mandatory')
    expect(src).not.toContain('Templates are MANDATORY')
  })
})

describe('SkillGenerator (alpha.11 single skill)', () => {
  let generator: SkillGenerator
  let originalHome: string
  let tmpHome: string

  beforeEach(async () => {
    generator = new SkillGenerator()
    originalHome = os.homedir()
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-gen-test-'))
    process.env.HOME = tmpHome
  })

  afterEach(async () => {
    process.env.HOME = originalHome
    await fs.rm(tmpHome, { recursive: true, force: true }).catch(() => {})
  })

  describe('definitions', () => {
    it('ships a single `prjct` skill', () => {
      expect(SKILL_DEFINITIONS).toHaveLength(1)
      expect(SKILL_DEFINITIONS[0].name).toBe('prjct')
    })

    it('is unconditional — always generated', () => {
      expect(SKILL_DEFINITIONS[0].condition(makeConditionContext())).toBe(true)
    })

    it('is user-invocable', () => {
      expect(SKILL_DEFINITIONS[0].userInvocable ?? true).toBe(true)
    })
  })

  describe('generateAndInstall', () => {
    it('generates the `prjct` skill', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      expect(result.generated).toHaveLength(1)
      expect(result.generated[0].name).toBe('prjct')
      expect(result.skipped).toHaveLength(0)
    })

    it('writes SKILL.md at the expected path', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const skill = result.generated[0]
      expect(skill.path).toContain('.claude/skills/')
      expect(skill.path).toEndWith('/SKILL.md')
      const exists = await fs
        .access(skill.path)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    })

    it('skill body includes the canonical anti-harness sections', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('## Use when')
      expect(content).toContain("## What's here")
      expect(content).toContain('## Gotchas')
    })

    it('exposes primitives (capture, remember, context, workflow, seed)', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('prjct capture')
      expect(content).toContain('prjct remember')
      expect(content).toContain('prjct context memory')
      expect(content).toContain('prjct workflow')
      expect(content).toContain('prjct seed')
    })

    it('references the wiki data paths', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('.prjct/wiki/_generated/')
      expect(content).toContain('.prjct/wiki/captured/')
      expect(content).toContain('.prjct/prjct.config.json')
    })

    it('includes project name, stack, and branch in the body', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('my-app')
      expect(content).toContain('TypeScript')
      expect(content).toContain('feat/alpha11')
    })

    it('frontmatter has valid Claude Code native format', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toStartWith('---\n')
      expect(content).toContain('description:')
      expect(content).toContain('allowed-tools:')
      // Second --- closes frontmatter
      const secondDash = content.indexOf('---', 4)
      expect(secondDash).toBeGreaterThan(0)
    })

    it('regenerates on every call (picks up new branch)', async () => {
      await generator.generateAndInstall(makeSyncResult())
      const result2 = await generator.generateAndInstall(
        makeSyncResult({
          git: {
            branch: 'fix/different',
            commits: 100,
            contributors: 3,
            hasChanges: false,
            stagedFiles: [],
            modifiedFiles: [],
            untrackedFiles: [],
            recentCommits: [],
            weeklyCommits: 5,
          },
        })
      )
      const content = await fs.readFile(result2.generated[0].path, 'utf-8')
      expect(content).toContain('fix/different')
      expect(content).not.toContain('feat/alpha11')
    })
  })

  describe('rich context injection', () => {
    it('includes patterns from analysis', async () => {
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext(),
        makeRichContext()
      )
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('Storage Layer Abstraction')
    })

    it('includes active task when present', async () => {
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext(),
        makeRichContext()
      )
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('Wire alpha.11 hooks')
    })

    it('omits rich sections gracefully when empty', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      // Empty project → no Patterns / Anti-Patterns / Velocity blocks
      expect(content).not.toContain('## Patterns')
      expect(content).not.toContain('## Anti-Patterns')
      expect(content).not.toContain('## Velocity')
    })
  })

  describe('anti-harness enforcement', () => {
    it('contains no numbered "do X then Y" steps', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      // No "1. ", "2. ", "3. " in the body (outside the frontmatter /
      // data blocks). Keep the check conservative — just look for the
      // numbered-step pattern with a verb that suggests prescription.
      expect(content).not.toMatch(/^\s*1\.\s+Register\b/m)
      expect(content).not.toMatch(/^\s*2\.\s+Tag\b/m)
      expect(content).not.toMatch(/^\s*###\s*1\.\s/m)
    })

    it('contains no BLOCKING / MANDATORY directives', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).not.toContain('BLOCKING')
      expect(content).not.toContain('MANDATORY')
      expect(content).not.toContain('## Constraints')
    })

    it('contains no "Pre-flight" ceremony', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).not.toContain('Pre-flight')
    })
  })

  // gstack-inspired patterns. Heavy reviews must instruct the agent to
  // dispatch a subagent so the parent's context window doesn't fill with
  // file reads. The audit orchestrator must demand parallel dispatch.
  describe('subagent + orchestrator patterns', () => {
    it('declares the subagent dispatch section with general-purpose type', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('### Subagent dispatch')
      expect(content).toContain('subagent_type: "general-purpose"')
      expect(content).toContain('context-rot defense')
    })

    it('instructs review/security/investigate to dispatch as subagents', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      // Each heavy workflow must mention dispatching when scope is non-trivial.
      const reviewSection = content.split('### `review`')[1]?.split('### `qa`')[0] ?? ''
      expect(reviewSection).toContain('Dispatch as subagent')
      const securitySection =
        content.split('### `security`')[1]?.split('### `investigate`')[0] ?? ''
      expect(securitySection).toContain('Dispatch as subagent')
      const investigateSection = content.split('### `investigate`')[1]?.split('### `ship`')[0] ?? ''
      expect(investigateSection).toContain('Dispatch the trace+hypothesis phase as a subagent')
    })

    it('exposes the audit orchestrator with parallel dispatch instructions', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('### `audit`')
      expect(content).toContain('IN PARALLEL')
      // The three sub-workflows the orchestrator runs.
      expect(content).toMatch(/Subagent A.*review/)
      expect(content).toMatch(/Subagent B.*security/)
      expect(content).toMatch(/Subagent C.*investigate/)
      // The skill description must advertise the new workflow.
      expect(content).toMatch(/quality reviews \(review, qa, security, investigate, audit\)/)
    })

    it('teaches the decision-brief format for non-trivial AskUserQuestion calls', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('### Decision-brief format')
      expect(content).toContain('ELI10:')
      expect(content).toContain('Stakes if we pick wrong')
      expect(content).toContain('Recommendation:')
    })
  })
})
