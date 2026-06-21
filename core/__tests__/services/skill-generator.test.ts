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
import { SKILL_DEFINITIONS, SkillGenerator } from '../../services/skill-generator'
import type { ConditionContext, SkillContext } from '../../services/skill-generator/types'
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
    knownGotchas: ['SQLite WAL mode can cause locking in parallel tests'],
    pausedTasks: [],
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
      expect(content).toContain('### Agent contract')
      expect(content).toContain('## Gotchas')
    })

    it('always-loaded body carries the loop-discipline triggers + model quick-ref', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      // Stop/delegate triggers (the codified loop-safety net).
      expect(content).toContain('## Loop discipline')
      expect(content).toContain('Reading **4+ files**')
      expect(content).toContain('Touching **2+ non-trivial files**')
      expect(content).toContain('commit / push / open a PR')
      expect(content).toContain('worktree/git accident')
      // Model policy reachable without pulling workflows.md.
      expect(content).toContain('never omit `model:`')
      expect(content).toContain('`model: "sonnet"`')
    })

    it('states the portable agent contract for Claude and GPT', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('prjct remembers project state and shows the path')
      expect(content).toContain('Claude, GPT, and other agents decide the concrete HOW')
      expect(content).toContain('Treat prjct output as durable signals')
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

    it('State is counts-only — no task description text (token diet R3)', async () => {
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext(),
        makeRichContext()
      )
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      // Task DESCRIPTIONS are stale by the next sync and duplicated by the
      // per-turn prompt hook — the body must never bake them in.
      expect(content).not.toContain('Wire alpha.11 hooks')
      expect(content).toContain('## State')
      expect(content).toContain('detail via `prjct context --md`')
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

  // Context-efficiency pivot (2.37): the heavy methodology (subagent
  // dispatch, audit orchestrator, decision-brief, builder ethos, quality
  // workflows) moved OUT of the always-in-context SKILL.md body into the
  // pulled-on-demand `workflows.md` reference written next to it. These
  // tests assert it ships on disk in the reference, and that the lean
  // SKILL.md points to it without inlining it.
  describe('deep-methodology reference (workflows.md)', () => {
    async function readReference(): Promise<string> {
      const result = await generator.generateAndInstall(makeSyncResult())
      const dir = path.dirname(result.generated[0].path)
      return fs.readFile(path.join(dir, 'workflows.md'), 'utf-8')
    }

    it('writes workflows.md next to SKILL.md', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const dir = path.dirname(result.generated[0].path)
      const exists = await fs
        .access(path.join(dir, 'workflows.md'))
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    })

    it('keeps SKILL.md lean — points at the reference, does not inline it', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('workflows.md')
      // Heavy methodology must NOT sit in the always-in-context body.
      expect(content).not.toContain('### Subagent dispatch')
      expect(content).not.toContain('## Quality workflows')
      expect(content).not.toContain('## Builder ethos')
    })

    it('declares the subagent dispatch section with general-purpose type', async () => {
      const ref = await readReference()
      expect(ref).toContain('### Subagent dispatch')
      expect(ref).toContain('subagent_type: "general-purpose"')
      expect(ref).toContain('context-rot defense')
    })

    it('instructs review/security/investigate to dispatch as subagents', async () => {
      const ref = await readReference()
      const reviewSection = ref.split('### `review`')[1]?.split('### `qa`')[0] ?? ''
      expect(reviewSection).toContain('Dispatch as subagent')
      const securitySection = ref.split('### `security`')[1]?.split('### `investigate`')[0] ?? ''
      expect(securitySection).toContain('Dispatch as subagent')
      const investigateSection = ref.split('### `investigate`')[1]?.split('### `ship`')[0] ?? ''
      expect(investigateSection).toContain('Dispatch the trace+hypothesis phase as a subagent')
    })

    it('exposes the audit orchestrator with parallel dispatch instructions', async () => {
      const ref = await readReference()
      expect(ref).toContain('### `audit`')
      expect(ref).toContain('IN PARALLEL')
      expect(ref).toMatch(/Subagent A.*review/)
      expect(ref).toMatch(/Subagent B.*security/)
      expect(ref).toMatch(/Subagent C.*investigate/)
    })

    it('scopes heavy-review subagent dispatch to diff size — in the pulled reference, not the always-on description', async () => {
      // The always-on skill description is a lean trigger; the subagent-
      // dispatch scoping rule (don't over-dispatch on small diffs) lives in
      // workflows.md, pulled only when a heavy workflow actually runs.
      const ref = await readReference()
      expect(ref).toMatch(/dispatch the read-and-analyze step as a subagent/i)
      expect(ref).toContain('Skip the subagent only for: diffs under 5 files')
    })

    it('teaches the decision-brief format for non-trivial AskUserQuestion calls', async () => {
      const ref = await readReference()
      expect(ref).toContain('### Decision-brief format')
      expect(ref).toContain('ELI10:')
      expect(ref).toContain('Stakes if we pick wrong')
      expect(ref).toContain('Recommendation:')
    })

    it('embeds the three builder-ethos principles before quality workflows', async () => {
      const ref = await readReference()
      expect(ref).toContain('## Builder ethos')
      expect(ref).toContain('### Boil the Lake')
      expect(ref).toContain('### Search before building')
      expect(ref).toContain('### User sovereignty')
      const ethosIdx = ref.indexOf('## Builder ethos')
      const qualityIdx = ref.indexOf('## Quality workflows')
      expect(ethosIdx).toBeGreaterThan(0)
      expect(qualityIdx).toBeGreaterThan(ethosIdx)
    })

    it('includes user-sovereignty anti-patterns the model must refuse', async () => {
      const ref = await readReference()
      expect(ref).toMatch(/outside voice is right.*Present it\. Ask\./)
      expect(ref).toContain('Agreement is signal, not proof')
    })
  })

  // Verb intent map — the LLM is the intent engine. The lean SKILL.md
  // carries a compact intent→verb→tier TABLE (the per-verb prose moved to
  // the reference) so routing stays in context without the bulk.
  describe('verb intent map (UX phase 1)', () => {
    it('declares the verb intent map as a compact intent→verb→tier table', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('## Verb intent map')
      expect(content).toContain('you run the verb, the user never types it')
      expect(content).toContain('| Intent / signal | Verb | Tier |')
      // Regression lock (recurring [Triage before spec] / [Right-size
      // ceremony]): the DIRECT-default gate is prominent and `task` (the
      // default) precedes `spec`/`audit-spec` in the verb table.
      expect(content).toContain('## Act: default DIRECT')
      const verbMap = content.split('## Verb intent map')[1]?.split('## Routing')[0] ?? ''
      expect(verbMap.indexOf('`prjct task')).toBeGreaterThan(-1)
      expect(verbMap.indexOf('`prjct task')).toBeLessThan(verbMap.indexOf('`prjct spec'))
      expect(verbMap.indexOf('`prjct task')).toBeLessThan(verbMap.indexOf('`prjct audit-spec'))
      // Routine verbs present in the table.
      expect(verbMap).toContain('`prjct capture')
      expect(verbMap).toContain('`prjct remember decision')
      expect(verbMap).toContain('`prjct remember learning')
      expect(verbMap).toContain('`prjct remember gotcha')
      expect(verbMap).toContain('`prjct ship`')
      expect(verbMap).toContain('`prjct health --md`')
      expect(verbMap).toContain('`prjct retro 7d --md`')
      expect(verbMap).toContain('`prjct context-save`')
    })

    it('explicitly tells the model NOT to make the user type commands', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('you run the verb, the user never types it')
      // Skill description carries the same contract.
      const description = content.split('description:')[1]?.split('\n')[0] ?? ''
      expect(description).toMatch(/never make the user type commands/i)
    })
  })

  // Routing protocol — three tiers based on blast radius (condensed from
  // the old per-tier sections into a tight list in the lean body).
  describe('routing protocol (UX phase 2)', () => {
    it('declares the three-tier routing protocol by blast radius', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('## Routing')
      expect(content).toContain('Tier 1 — auto-execute')
      expect(content).toContain('Tier 2 — suggest-and-confirm')
      expect(content).toContain('Tier 3 — decision-brief')
    })

    it('groups capture / tag / remember / guard / context-save / health / retro into Tier 1', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      const tier1 = content.split('Tier 1 — auto-execute')[1]?.split('Tier 2 —')[0] ?? ''
      expect(tier1).toContain('`capture`')
      expect(tier1).toContain('`tag`')
      expect(tier1).toContain('`remember`')
      expect(tier1).toContain('`guard`')
      expect(tier1).toContain('`context-save`')
      expect(tier1).toContain('`health`')
      expect(tier1).toContain('`retro`')
    })

    it('groups task / ship / status into Tier 2 (suggest-and-confirm)', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      const tier2 = content.split('Tier 2 — suggest-and-confirm')[1]?.split('Tier 3 —')[0] ?? ''
      expect(tier2).toContain('`task`')
      expect(tier2).toContain('`ship`')
      expect(tier2).toContain('`status done|paused`')
      // Heavy quality workflows (`audit`/`review`/`security`/`investigate`)
      // moved out of the lean body into workflows.md — no longer in Tier 2.
    })

    it('refuses pausing on routine captures and shipping without a surfaced plan', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toMatch(/Do not ask "want me to save that\?"/)
      expect(content).toMatch(/Never run `ship` without surfacing the plan first/)
    })
  })
})
