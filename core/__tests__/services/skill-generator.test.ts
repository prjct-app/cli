/**
 * Tests for native Claude Code skill generation.
 *
 * Validates:
 * 1. All 16 skills are generated (14 unconditional + 2 conditional)
 * 2. Conditional skills respect their conditions
 * 3. Generated content includes real project context (patterns, anti-patterns, velocity, etc.)
 * 4. Skills are installed to correct paths
 * 5. Frontmatter is valid Claude Code native format
 * 6. Skills contain embedded workflow with CLI commands
 * 7. Skills with state (done, pause, resume, next) include inline data
 * 8. prjct-context includes ## State and ## User Patterns sections
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

// Minimal sync result for testing
function makeSyncResult(overrides: Partial<ProjectSyncResult> = {}): ProjectSyncResult {
  return {
    success: true,
    projectId: 'test-project-id',
    cliVersion: '1.47.0',
    git: {
      branch: 'feat/awesome',
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

// Rich context fixture for testing
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
      {
        name: 'Event-driven pub-sub',
        description: 'Cross-module communication via eventBus',
      },
    ],
    antiPatterns: [
      {
        issue: 'Unbounded any type',
        file: 'multiple',
        suggestion: 'Use explicit types or unknown with narrowing',
        severity: 'high',
      },
      {
        issue: 'Unscoped @ts-ignore',
        file: 'core/services/pattern-extractor.ts',
        suggestion: 'Use @ts-expect-error with rationale',
        severity: 'medium',
      },
    ],
    recentShipped: [
      { name: 'Static context removal', type: 'refactor', duration: '3h 45m', filesChanged: 8 },
      {
        name: 'Centralize type definitions',
        type: 'refactor',
        duration: '2h 10m',
        filesChanged: 15,
      },
    ],
    velocity: { avgPoints: 21, trend: 'stable', accuracy: 78 },
    backlogCount: 5,
    completedTaskCount: 12,
    pausedTaskCount: 1,
    knownGotchas: [
      'Type inference complexity in generic storage methods',
      'SQLite WAL mode can cause locking in parallel tests',
    ],

    // Task state
    hasActiveTask: true,
    activeTaskDescription: 'Implement skill generator expansion',
    pausedTasks: [{ description: 'Fix auth flow', pausedAt: '2026-02-24' }],
    topBacklog: [
      { description: 'Add webhook support', priority: 'high' },
      { description: 'Improve error messages', priority: 'medium' },
      { description: 'Add telemetry', priority: 'low' },
    ],
    ideasCount: 7,
    shippedCount: 15,

    // User patterns from aggregated feedback
    userPatterns: [
      'Always uses bun instead of npm',
      'Prefers functional style over class-based',
      'SQLite WAL mode can cause locking in parallel tests',
    ],
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
    // Read source to verify inline constant (not exported)
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

describe('SkillGenerator', () => {
  let generator: SkillGenerator
  let originalHome: string
  let tmpHome: string

  beforeEach(async () => {
    generator = new SkillGenerator()
    originalHome = os.homedir()

    // Create temp home to avoid writing to real ~/.claude/skills/
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-gen-test-'))

    // Mock os.homedir to return tmp dir
    // We need to override the skill output path — use env HOME
    process.env.HOME = tmpHome
  })

  afterEach(async () => {
    process.env.HOME = originalHome
    await fs.rm(tmpHome, { recursive: true, force: true }).catch(() => {})
  })

  describe('definitions', () => {
    it('has 16 skill definitions', () => {
      expect(SKILL_DEFINITIONS).toHaveLength(16)
    })

    it('all unconditional skills return true for empty context', () => {
      const ctx = makeConditionContext()
      const unconditional = SKILL_DEFINITIONS.filter((d) => d.condition(ctx))
      // All except prjct-plan (backlog > 0) and prjct-velocity (completedTaskCount >= 5)
      expect(unconditional.length).toBe(14)
    })

    it('prjct-plan requires backlog > 0', () => {
      const plan = SKILL_DEFINITIONS.find((d) => d.name === 'prjct-plan')!
      expect(plan.condition(makeConditionContext({ backlogCount: 0 }))).toBe(false)
      expect(plan.condition(makeConditionContext({ backlogCount: 1 }))).toBe(true)
    })

    it('prjct-velocity requires >= 5 completed tasks', () => {
      const velocity = SKILL_DEFINITIONS.find((d) => d.name === 'prjct-velocity')!
      expect(velocity.condition(makeConditionContext({ completedTaskCount: 4 }))).toBe(false)
      expect(velocity.condition(makeConditionContext({ completedTaskCount: 5 }))).toBe(true)
    })

    it('contains exactly the 16 expected skills', () => {
      const names = SKILL_DEFINITIONS.map((d) => d.name)
      expect(names).toEqual([
        'prjct-context',
        'prjct-task',
        'prjct-done',
        'prjct-ship',
        'prjct-pause',
        'prjct-resume',
        'prjct-next',
        'prjct-sync',
        'prjct-bug',
        'prjct-workflow',
        'prjct-enrich',
        'prjct-linear',
        'prjct-jira',
        'prjct-plan',
        'prjct-velocity',
        'prjct-tokens',
      ])
    })
  })

  describe('generateAndInstall', () => {
    it('generates 14 unconditional skills with empty conditions', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      expect(result.generated).toHaveLength(14)
      expect(result.skipped).toHaveLength(2)

      const names = result.generated.map((s) => s.name)
      expect(names).toContain('prjct-context')
      expect(names).toContain('prjct-task')
      expect(names).toContain('prjct-done')
      expect(names).toContain('prjct-ship')
      expect(names).toContain('prjct-pause')
      expect(names).toContain('prjct-resume')
      expect(names).toContain('prjct-next')
      expect(names).toContain('prjct-sync')
      expect(names).toContain('prjct-bug')
      expect(names).toContain('prjct-workflow')
      expect(names).toContain('prjct-enrich')
      expect(names).toContain('prjct-linear')
      expect(names).toContain('prjct-jira')
      expect(names).toContain('prjct-tokens')
    })

    it('generates all 16 skills when conditions are met', async () => {
      const result = await generator.generateAndInstall(makeSyncResult(), {
        backlogCount: 3,
        completedTaskCount: 10,
        pausedTaskCount: 1,
        hasActiveTask: true,
      })
      expect(result.generated).toHaveLength(16)
      expect(result.skipped).toHaveLength(0)
    })

    it('writes SKILL.md files to correct paths', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())

      for (const skill of result.generated) {
        const exists = await fs
          .access(skill.path)
          .then(() => true)
          .catch(() => false)
        expect(exists).toBe(true)
        expect(skill.path).toContain('.claude/skills/')
        expect(skill.path).toEndWith('/SKILL.md')
      }
    })

    it('generated content includes project name in prjct-context', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const contextSkill = result.generated.find((s) => s.name === 'prjct-context')!
      const content = await fs.readFile(contextSkill.path, 'utf-8')
      expect(content).toContain('my-app')
    })

    it('generated content includes stack info in prjct-context', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const contextSkill = result.generated.find((s) => s.name === 'prjct-context')!
      const content = await fs.readFile(contextSkill.path, 'utf-8')
      expect(content).toContain('TypeScript')
      expect(content).toContain('Hono')
    })

    it('generated content includes branch name in prjct-context', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const contextSkill = result.generated.find((s) => s.name === 'prjct-context')!
      const content = await fs.readFile(contextSkill.path, 'utf-8')
      expect(content).toContain('feat/awesome')
    })

    it('generated content includes project commands in prjct-context', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const contextSkill = result.generated.find((s) => s.name === 'prjct-context')!
      const content = await fs.readFile(contextSkill.path, 'utf-8')
      expect(content).toContain('npm run build')
      expect(content).toContain('npm test')
      expect(content).toContain('npm run lint')
    })

    it('frontmatter has valid Claude Code native format', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const taskSkill = result.generated.find((s) => s.name === 'prjct-task')!
      const content = await fs.readFile(taskSkill.path, 'utf-8')

      expect(content).toStartWith('---\n')
      expect(content).toContain('description:')
      expect(content).toContain('allowed-tools:')
      expect(content).toContain('user-invocable: true')
      // Second --- closes frontmatter
      const secondDash = content.indexOf('---', 4)
      expect(secondDash).toBeGreaterThan(0)
    })

    it('skipped skills report reason', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const skippedNames = result.skipped.map((s) => s.name)
      expect(skippedNames).toContain('prjct-plan')
      expect(skippedNames).toContain('prjct-velocity')
      for (const s of result.skipped) {
        expect(s.reason).toBe('condition not met')
      }
    })

    it('cleans up stale skills when condition is no longer met', async () => {
      // First: generate with conditions met (all 16 skills)
      const result1 = await generator.generateAndInstall(makeSyncResult(), {
        backlogCount: 3,
        completedTaskCount: 10,
        pausedTaskCount: 1,
        hasActiveTask: true,
      })
      expect(result1.generated).toHaveLength(16)

      // Verify plan skill was created at the path reported
      const planSkill = result1.generated.find((s) => s.name === 'prjct-plan')!
      const planExists = await fs
        .access(planSkill.path)
        .then(() => true)
        .catch(() => false)
      expect(planExists).toBe(true)

      // Get the plan directory from the generated path
      const planDir = path.dirname(planSkill.path)

      // Second: generate with conditions NOT met (backlog = 0)
      const result2 = await generator.generateAndInstall(makeSyncResult(), {
        backlogCount: 0,
        completedTaskCount: 3,
        pausedTaskCount: 0,
        hasActiveTask: false,
      })

      // prjct-plan should be skipped AND its directory cleaned up
      expect(result2.skipped.map((s) => s.name)).toContain('prjct-plan')
      const planStillExists = await fs
        .access(planDir)
        .then(() => true)
        .catch(() => false)
      expect(planStillExists).toBe(false)
    })

    it('regenerates skills on every call (always fresh)', async () => {
      // First generation
      await generator.generateAndInstall(makeSyncResult())

      // Second generation with different branch
      const result2 = await generator.generateAndInstall(
        makeSyncResult({
          git: {
            branch: 'fix/updated-branch',
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

      const contextSkill = result2.generated.find((s) => s.name === 'prjct-context')!
      const content = await fs.readFile(contextSkill.path, 'utf-8')
      expect(content).toContain('fix/updated-branch')
      expect(content).not.toContain('feat/awesome')
    })

    it('contains workflow with CLI commands (prjct task, prjct done, prjct ship)', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const taskSkill = result.generated.find((s) => s.name === 'prjct-task')!
      const content = await fs.readFile(taskSkill.path, 'utf-8')
      expect(content).toContain('prjct task "$ARGUMENTS" --md')
      expect(content).toContain('prjct done --md')
      expect(content).toContain('prjct ship --md')
    })
  })

  describe('rich context in skills', () => {
    it('prjct-context contains patterns from analysis', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext(),
        rich
      )
      const contextSkill = result.generated.find((s) => s.name === 'prjct-context')!
      const content = await fs.readFile(contextSkill.path, 'utf-8')

      expect(content).toContain('Storage Layer Abstraction')
      expect(content).toContain('Consistent StorageManager base class')
      expect(content).toContain('core/storage/')
      expect(content).toContain('Event-driven pub-sub')
    })

    it('prjct-context contains anti-patterns with severity', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext(),
        rich
      )
      const contextSkill = result.generated.find((s) => s.name === 'prjct-context')!
      const content = await fs.readFile(contextSkill.path, 'utf-8')

      expect(content).toContain('Unbounded any type')
      expect(content).toContain('HIGH')
      expect(content).toContain('Unscoped @ts-ignore')
      expect(content).toContain('MEDIUM')
    })

    it('prjct-context contains recent shipped features', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext(),
        rich
      )
      const contextSkill = result.generated.find((s) => s.name === 'prjct-context')!
      const content = await fs.readFile(contextSkill.path, 'utf-8')

      expect(content).toContain('Static context removal')
      expect(content).toContain('refactor')
      expect(content).toContain('3h 45m')
      expect(content).toContain('8 files')
      expect(content).toContain('Centralize type definitions')
    })

    it('prjct-context contains velocity when data exists', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext(),
        rich
      )
      const contextSkill = result.generated.find((s) => s.name === 'prjct-context')!
      const content = await fs.readFile(contextSkill.path, 'utf-8')

      expect(content).toContain('21 pts/sprint')
      expect(content).toContain('stable')
      expect(content).toContain('Estimation accuracy: 78%')
    })

    it('prjct-context contains known gotchas', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext(),
        rich
      )
      const contextSkill = result.generated.find((s) => s.name === 'prjct-context')!
      const content = await fs.readFile(contextSkill.path, 'utf-8')

      expect(content).toContain('Type inference complexity in generic storage methods')
      expect(content).toContain('SQLite WAL mode can cause locking in parallel tests')
    })

    it('prjct-context contains ## State section with task state', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext(),
        rich
      )
      const contextSkill = result.generated.find((s) => s.name === 'prjct-context')!
      const content = await fs.readFile(contextSkill.path, 'utf-8')

      expect(content).toContain('## State')
      expect(content).toContain('Active task: **Implement skill generator expansion**')
      expect(content).toContain('Paused: Fix auth flow (2026-02-24)')
      expect(content).toContain('Backlog: 5 items')
      expect(content).toContain('Add webhook support [high]')
      expect(content).toContain('Ideas: 7 pending')
      expect(content).toContain('Shipped: 15')
    })

    it('prjct-context contains ## User Patterns section', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext(),
        rich
      )
      const contextSkill = result.generated.find((s) => s.name === 'prjct-context')!
      const content = await fs.readFile(contextSkill.path, 'utf-8')

      expect(content).toContain('## User Patterns')
      expect(content).toContain('Always uses bun instead of npm')
      expect(content).toContain('Prefers functional style over class-based')
    })

    it('prjct-context omits State and User Patterns when empty', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const contextSkill = result.generated.find((s) => s.name === 'prjct-context')!
      const content = await fs.readFile(contextSkill.path, 'utf-8')

      expect(content).not.toContain('## State')
      expect(content).not.toContain('## User Patterns')
    })

    it('prjct-context omits empty sections gracefully', async () => {
      // No rich context = no patterns/anti-patterns/velocity sections
      const result = await generator.generateAndInstall(makeSyncResult())
      const contextSkill = result.generated.find((s) => s.name === 'prjct-context')!
      const content = await fs.readFile(contextSkill.path, 'utf-8')

      expect(content).not.toContain('## Patterns')
      expect(content).not.toContain('## Anti-Patterns')
      expect(content).not.toContain('## Velocity')
      expect(content).not.toContain('## Known Gotchas')
      expect(content).not.toContain('## Recent Deliveries')
    })

    it('prjct-context is not user-invocable', () => {
      const contextDef = SKILL_DEFINITIONS.find((d) => d.name === 'prjct-context')!
      expect(contextDef.userInvocable).toBe(false)
    })

    it('workflow skills do NOT contain patterns/anti-patterns', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        { backlogCount: 5, completedTaskCount: 10, pausedTaskCount: 1, hasActiveTask: true },
        rich
      )

      const workflowSkills = result.generated.filter((s) => s.name !== 'prjct-context')
      for (const skill of workflowSkills) {
        const content = await fs.readFile(skill.path, 'utf-8')
        expect(content).not.toContain('## Patterns')
        expect(content).not.toContain('## Anti-Patterns')
        expect(content).not.toContain('## Velocity')
        expect(content).not.toContain('## Known Gotchas')
        expect(content).not.toContain('## Recent Deliveries')
        expect(content).not.toContain('## Commands')
      }
    })

    it('rich context lives in prjct-context, NOT in workflow skills', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext(),
        rich
      )

      // prjct-context has the rich context
      const contextSkill = result.generated.find((s) => s.name === 'prjct-context')!
      const contextContent = await fs.readFile(contextSkill.path, 'utf-8')
      expect(contextContent).toContain('Storage Layer Abstraction')
      expect(contextContent).toContain('21 pts/sprint')
      expect(contextContent).toContain('Unbounded any type')

      // Workflow skills do NOT have patterns/anti-patterns
      const shipSkill = result.generated.find((s) => s.name === 'prjct-ship')!
      const shipContent = await fs.readFile(shipSkill.path, 'utf-8')
      expect(shipContent).not.toContain('Storage Layer Abstraction')
      expect(shipContent).not.toContain('21 pts/sprint')

      const bugSkill = result.generated.find((s) => s.name === 'prjct-bug')!
      const bugContent = await fs.readFile(bugSkill.path, 'utf-8')
      expect(bugContent).not.toContain('Unbounded any type')
    })

    it('conditional skills still respect conditions with rich context', async () => {
      const rich = makeRichContext()

      // backlogCount: 0 should still skip prjct-plan
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext({ backlogCount: 0, completedTaskCount: 3 }),
        rich
      )
      const names = result.generated.map((s) => s.name)
      expect(names).not.toContain('prjct-plan')
      expect(names).not.toContain('prjct-velocity')
    })

    it('no skill contains behavioral instructions like "Context7 mandatory"', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        { backlogCount: 5, completedTaskCount: 10, pausedTaskCount: 1, hasActiveTask: true },
        rich
      )

      for (const skill of result.generated) {
        const content = await fs.readFile(skill.path, 'utf-8')
        expect(content).not.toContain('Context7 mandatory')
        expect(content).not.toContain('Context7 docs')
      }
    })

    it('no skill contains ## Constraints section', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        { backlogCount: 5, completedTaskCount: 10, pausedTaskCount: 1, hasActiveTask: true },
        rich
      )

      for (const skill of result.generated) {
        const content = await fs.readFile(skill.path, 'utf-8')
        expect(content).not.toContain('## Constraints')
      }
    })

    it('version and file count appear in prjct-context header', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext(),
        rich
      )
      const contextSkill = result.generated.find((s) => s.name === 'prjct-context')!
      const content = await fs.readFile(contextSkill.path, 'utf-8')

      expect(content).toContain('200 files')
      expect(content).toContain('v2.0.0')
    })
  })

  describe('skills with inline state data', () => {
    it('prjct-done shows active task description', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext({ hasActiveTask: true }),
        rich
      )
      const doneSkill = result.generated.find((s) => s.name === 'prjct-done')!
      const content = await fs.readFile(doneSkill.path, 'utf-8')
      expect(content).toContain('Implement skill generator expansion')
    })

    it('prjct-pause shows active task description', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext({ hasActiveTask: true }),
        rich
      )
      const pauseSkill = result.generated.find((s) => s.name === 'prjct-pause')!
      const content = await fs.readFile(pauseSkill.path, 'utf-8')
      expect(content).toContain('Implement skill generator expansion')
    })

    it('prjct-resume lists paused tasks', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext({ pausedTaskCount: 1 }),
        rich
      )
      const resumeSkill = result.generated.find((s) => s.name === 'prjct-resume')!
      const content = await fs.readFile(resumeSkill.path, 'utf-8')
      expect(content).toContain('Fix auth flow')
      expect(content).toContain('2026-02-24')
    })

    it('prjct-next shows top backlog items', async () => {
      const rich = makeRichContext()
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext({ backlogCount: 5 }),
        rich
      )
      const nextSkill = result.generated.find((s) => s.name === 'prjct-next')!
      const content = await fs.readFile(nextSkill.path, 'utf-8')
      expect(content).toContain('5 items in backlog')
      expect(content).toContain('Add webhook support')
      expect(content).toContain('high')
    })
  })

  describe('prjct-workflow', () => {
    it('mentions gates, hooks, and NL support', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const workflowSkill = result.generated.find((s) => s.name === 'prjct-workflow')!
      const content = await fs.readFile(workflowSkill.path, 'utf-8')
      expect(content).toContain('Gates')
      expect(content).toContain('Hooks')
      expect(content).toContain('English')
      expect(content).toContain('Spanish')
    })
  })

  describe('prjct-sync body', () => {
    it('does NOT mention agent generation', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const syncSkill = result.generated.find((s) => s.name === 'prjct-sync')!
      const content = await fs.readFile(syncSkill.path, 'utf-8')
      expect(content).not.toContain('Agent generation')
      expect(content).not.toContain('workflow agents')
    })
  })
})
