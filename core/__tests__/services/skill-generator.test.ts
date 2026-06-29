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
import { countTokens } from '../../tools/context/token-counter'
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

    it('surfaces the opt-in tdd + sdd verbs in the always-loaded body', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('`prjct tdd`')
      expect(content).toMatch(/test-first|TDD/)
      expect(content).toContain('`prjct sdd`')
      expect(content).toMatch(/intent-first|SDD/)
    })

    it('teaches the sovereign knowledge base so agents pull it, never inject it', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      // KB facets are first-class, capturable, and discoverable to any rig.
      for (const facet of ['identity', 'voice', 'glossary', 'framework']) {
        expect(content).toContain(facet)
      }
      expect(content).toContain('sovereign knowledge base')
      expect(content).toContain('prjct context memory <facet>')
      // Clean-repo doctrine surfaced in the skill itself.
      expect(content).toContain('never injected into CLAUDE.md / AGENTS.md')
    })

    it('frames work as the single entrypoint for transparent AI Agile orchestration', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('`prjct work` is the single normal entrypoint')
      expect(content).toContain('Trivial work proceeds directly')
      expect(content).toContain('Substantive implementation work follows a persisted intent')
      expect(content).toContain('write tests before implementation')
      expect(content).not.toContain('**NO spec, NO audit-spec, NO subagents, NO fan-out.**')
    })

    it('keeps loop-discipline triggers + model quick-ref in the pulled reference', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      const dir = path.dirname(result.generated[0].path)
      const ref = await fs.readFile(path.join(dir, 'workflows.md'), 'utf-8')

      expect(content).toContain('loop-discipline triggers live in `workflows.md`')
      expect(content).not.toContain('## Loop discipline')
      expect(content).not.toContain('Reading **4+ files**')
      expect(content).not.toContain('Touching **2+ non-trivial files**')

      // Stop/delegate triggers remain available, but only when workflows.md
      // is intentionally pulled for quality workflows.
      expect(ref).toContain('## Loop discipline')
      expect(ref).toContain('Reading **4+ files**')
      expect(ref).toContain('Touching **2+ non-trivial files**')
      expect(ref).toContain('commit / push / open a PR')
      expect(ref).toContain('worktree/git accident')
      expect(ref).toContain('`model: "sonnet"`')
    })

    it('states the portable agent contract for Claude and GPT', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('prjct remembers project state and shows the path')
      expect(content).toContain('Agents decide HOW with native tools and judgment')
      expect(content).toContain('Treat prjct output as durable signals')
    })

    it('exposes v3 primitives (work, intent, remember, context, workflow, seed)', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('prjct work')
      expect(content).toContain('prjct intent')
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

    it('keeps the always-loaded SKILL.md under the token budget', async () => {
      const result = await generator.generateAndInstall(
        makeSyncResult(),
        makeConditionContext(),
        makeRichContext()
      )
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(countTokens(content)).toBeLessThanOrEqual(2600)
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
      // Regression lock: `work` is the normal orchestration entrypoint; it
      // precedes manual intent/spec verbs and carries the persisted station contract.
      expect(content).toContain('## Act: `prjct work` is the single normal entrypoint')
      const verbMap = content.split('## Verb intent map')[1]?.split('## Routing')[0] ?? ''
      expect(verbMap.indexOf('`prjct work')).toBeGreaterThan(-1)
      expect(verbMap.indexOf('`prjct work')).toBeLessThan(verbMap.indexOf('`prjct intent'))
      // Routine verbs present in the table.
      expect(verbMap).toContain('`prjct search')
      expect(verbMap).toContain('`prjct remember decision')
      expect(verbMap).toContain('`prjct remember learning')
      expect(verbMap).toContain('`prjct remember gotcha')
      expect(verbMap).toContain('`prjct ship`')
      expect(verbMap).toContain('`prjct insights value --md`')
      expect(verbMap).toContain('`prjct insights reliability --md`')
      expect(verbMap).toContain('`prjct insights report 7 --md`')
      expect(verbMap).toContain('`prjct performance 7 --md`')
      expect(verbMap).toContain('`prjct context-save`')
    })

    it('explicitly tells the model NOT to make the user type commands', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('you run the verb, the user never types it')
      // Skill description carries the same contract.
      const description = content.split('description:')[1]?.split('\n')[0] ?? ''
      expect(description).toMatch(/run the prjct verb yourself/i)
    })

    it('teaches living context synthesis as product behavior for every project', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      expect(content).toContain('Living context synthesis')
      expect(content).toContain('same model that just executed the task')
      expect(content).toContain('Context synthesis')
      expect(content).toContain('Key data')
      expect(content).toContain('UI can filter')
      expect(content).toContain('What happened')
      expect(content).toContain('Why it mattered')
      expect(content).toContain('Who/author')
      expect(content).toContain('Model')
      expect(content).toContain('Token usage')
      expect(content).toContain('Sentiment')
      expect(content).toContain('Related files')
      expect(content).toContain('Feature/domain')
      expect(content).toContain('Pattern')
      expect(content).toContain('Anti-pattern')
      expect(content).toContain('Next implication')
      expect(content).toContain('Raw detector output is input, not the final context')
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

    it('groups memory / guard / insights / performance into Tier 1', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      const tier1 = content.split('Tier 1 — auto-execute')[1]?.split('Tier 2 —')[0] ?? ''
      expect(tier1).toContain('`search`')
      expect(tier1).toContain('`remember`')
      expect(tier1).toContain('`guard`')
      expect(tier1).toContain('`insights`')
      expect(tier1).toContain('`performance`')
      expect(tier1).toContain('`context-save`')
    })

    it('groups work / intent / ship into Tier 2 (suggest-and-confirm)', async () => {
      const result = await generator.generateAndInstall(makeSyncResult())
      const content = await fs.readFile(result.generated[0].path, 'utf-8')
      const tier2 = content.split('Tier 2 — suggest-and-confirm')[1]?.split('Tier 3 —')[0] ?? ''
      expect(tier2).toContain('`work`')
      expect(tier2).toContain('`intent`')
      expect(tier2).toContain('`ship`')
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
