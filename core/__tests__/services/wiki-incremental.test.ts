/**
 * Wiki Generator — incrementality + historical preservation invariants.
 *
 * These are the load-bearing guarantees the rest of the vault layer
 * depends on. Lock them down so future regressions trip the test suite
 * instead of silently degrading agent context.
 *
 * Invariants under test:
 *
 *   A. Manifest-based file diff (per-file incrementality)
 *      A.1 First regen writes every file; skips none.
 *      A.2 Re-regen with no DB changes writes 0 files; skips all.
 *      A.3 Adding a single memory entry rewrites only files that depend
 *          on memory state; analysis files stay untouched.
 *
 *   B. Concept-level historical preservation
 *      B.1 A concept seen across two analyses keeps the original
 *          firstSeen date; lastSeen advances; seenIn count grows.
 *      B.2 A concept that disappears from the latest active analysis
 *          stays in the vault as historical, marked stillActive=false.
 *      B.3 The concept file path (slug) is stable across regens — agents
 *          and links can rely on it.
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import { projectMemory } from '../../memory/project-memory'
import { setTaskStatus } from '../../services/task-service'
import {
  ANALYSIS_MAP_FILE,
  RELEASE_HISTORY_FILE,
  VAULT_HOME_FILE,
} from '../../services/wiki/_shared'
import { FINGERPRINT_FILE } from '../../services/wiki/fingerprint'
import { generateWiki } from '../../services/wiki-generator'
import { prjctDb } from '../../storage/database'
import llmAnalysisStorage from '../../storage/llm-analysis-storage'
import { stateStorage } from '../../storage/state-storage'
import type { LLMAnalysis, LLMPattern } from '../../types/llm-analysis'

// Sandbox

let tmpRoot: string
let projectRoot: string
let vaultRoot: string
let generatedRoot: string
const projectId = 'wiki-incremental-test'

const spies: Array<ReturnType<typeof spyOn>> = []

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-wiki-incr-'))
  projectRoot = path.join(tmpRoot, 'proj')
  vaultRoot = path.join(tmpRoot, 'vault')
  generatedRoot = path.join(vaultRoot, '_generated')

  await fs.mkdir(path.join(projectRoot, '.prjct'), { recursive: true })
  await fs.writeFile(
    path.join(projectRoot, '.prjct', 'prjct.config.json'),
    // Vault generation is off by default (prjct = LLM data plane); these tests
    // exercise the generator, so they opt into `export`.
    JSON.stringify({ projectId, dataPath: '', vault: { mode: 'export' } }, null, 2)
  )

  // Redirect every path the wiki layer might consult into our sandbox.
  spies.push(spyOn(pathManager, 'getWikiPath').mockImplementation(async () => vaultRoot))
  spies.push(
    spyOn(pathManager, 'getGlobalProjectPath').mockImplementation((pid: string) =>
      path.join(tmpRoot, 'globals', pid)
    )
  )
  spies.push(
    spyOn(pathManager, 'getFilePath').mockImplementation(
      (pid: string, layer: string, filename: string) =>
        path.join(tmpRoot, 'globals', pid, layer, filename)
    )
  )

  // prjctDb opens the SQLite file under getGlobalProjectPath; ensure it exists.
  await fs.mkdir(path.join(tmpRoot, 'globals', projectId), { recursive: true })
  prjctDb.getDb(projectId)
})

afterEach(async () => {
  prjctDb.close()
  for (const s of spies) s.mockRestore()
  spies.length = 0
  ;(configManager as { clearCache?: () => void }).clearCache?.()
  await fs.rm(tmpRoot, { recursive: true, force: true })
})

// Helpers

function makeAnalysis(opts: {
  analyzedAt: string
  commitHash?: string
  patterns?: Array<Pick<LLMPattern, 'name' | 'description'> & Partial<LLMPattern>>
  insights?: string[]
}): LLMAnalysis {
  return {
    version: 1,
    commitHash: opts.commitHash ?? null,
    analyzedAt: opts.analyzedAt,
    architecture: { style: 'modular-monolith', insights: [], domains: [] },
    patterns: (opts.patterns ?? []).map((p) => ({
      name: p.name,
      description: p.description,
      locations: p.locations ?? [],
      confidence: p.confidence ?? 0.9,
      category: p.category ?? 'architecture',
    })),
    antiPatterns: [],
    techDebt: [],
    riskAreas: [],
    refactorSuggestions: [],
    projectInsights: opts.insights ?? [],
    conventions: [],
  }
}

async function readFrontmatter(relPath: string): Promise<Record<string, string>> {
  const raw = await fs.readFile(path.join(generatedRoot, relPath), 'utf-8')
  const m = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!m) throw new Error(`No frontmatter in ${relPath}`)
  const out: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return out
}

function appendMemoryEvent(type: string, content: string, tags: Record<string, string> = {}): void {
  prjctDb.appendEvent(projectId, `memory.remember.${type}`, {
    content,
    tags,
    provenance: 'declared',
  })
}

// A. Manifest-based file diff

describe('Wiki Generator — manifest incrementality', () => {
  it('regenerates immediately after a project memory write', async () => {
    await projectMemory.remember(projectRoot, {
      type: 'decision',
      content: 'Store synthesized context as the product value.',
      tags: { feature: 'living-context' },
      projectId,
    })

    const decisionPage = await fs.readFile(
      path.join(generatedRoot, 'memory', 'decision.md'),
      'utf-8'
    )
    expect(decisionPage).toContain('Store synthesized context as the product value.')
  })

  it('regenerates immediately when a task is completed', async () => {
    await generateWiki(projectRoot, projectId)
    const before = await fs.readFile(path.join(generatedRoot, FINGERPRINT_FILE), 'utf-8')
    await stateStorage.startTask(projectId, {
      id: 'vault-regen-task',
      description: 'prove task close regenerates vault',
      sessionId: 's1',
    } as Parameters<typeof stateStorage.startTask>[1])

    const done = await setTaskStatus(projectId, projectRoot, 'done')

    expect(done.ok).toBe(true)
    const after = await fs.readFile(path.join(generatedRoot, FINGERPRINT_FILE), 'utf-8')
    expect(after).not.toBe(before)
  })

  it('A.1 first regen writes every file; skips none', async () => {
    llmAnalysisStorage.save(
      projectId,
      makeAnalysis({
        analyzedAt: '2026-01-10T00:00:00Z',
        patterns: [{ name: 'Foo', description: 'foo desc' }],
      })
    )

    const result = await generateWiki(projectRoot, projectId)

    expect(result.filesWritten).toBeGreaterThan(0)
    expect(result.filesSkipped).toBe(0)
    expect(result.filesRemoved).toBe(0)
    // Manifest must exist for the diff to work next run. Use bracket
    // access — bun's toHaveProperty treats dots as path separators.
    const manifest = JSON.parse(
      await fs.readFile(path.join(generatedRoot, '.manifest.json'), 'utf-8')
    ) as Record<string, string>
    expect(manifest[VAULT_HOME_FILE]).toBeDefined()
    expect(manifest['analysis/patterns/foo.md']).toBeDefined()
  })

  it('A.1b emits semantic vault filenames and readable relationship sections', async () => {
    appendMemoryEvent('decision', 'Use SQLite as the durable project brain', {
      domain: 'memory',
      feature: 'vault',
      workflow: 'sync',
    })
    appendMemoryEvent('gotcha', 'Generic README filenames make the vault hard to navigate', {
      domain: 'memory',
      feature: 'vault',
      workflow: 'sync',
    })
    llmAnalysisStorage.save(
      projectId,
      makeAnalysis({
        analyzedAt: '2026-01-10T00:00:00Z',
        patterns: [{ name: 'Vault relationship map', description: 'Readable second-brain links' }],
      })
    )
    await fs.mkdir(path.join(generatedRoot, 'analysis'), { recursive: true })
    await fs.mkdir(path.join(generatedRoot, 'specs'), { recursive: true })
    await fs.mkdir(path.join(generatedRoot, 'workflows'), { recursive: true })
    await fs.mkdir(path.join(vaultRoot, 'captured'), { recursive: true })
    await fs.mkdir(path.join(vaultRoot, 'workflows'), { recursive: true })
    await fs.writeFile(
      path.join(vaultRoot, 'README.md'),
      '# prjct Vault\n\nOpen this folder as an Obsidian vault.\n',
      'utf-8'
    )
    await fs.writeFile(
      path.join(vaultRoot, 'captured', 'README.md'),
      '# How to Capture Notes\n\ntype: learning\n',
      'utf-8'
    )
    await fs.writeFile(
      path.join(vaultRoot, 'workflows', 'README.md'),
      '# Workflows (Obsidian dropzone)\n\nWorkflow rules.\n',
      'utf-8'
    )
    await fs.writeFile(path.join(generatedRoot, 'index.md'), '# old home\n', 'utf-8')
    await fs.writeFile(
      path.join(generatedRoot, 'analysis', 'index.md'),
      '# old analysis\n',
      'utf-8'
    )
    await fs.writeFile(path.join(generatedRoot, 'specs', '_index.md'), '# old specs\n', 'utf-8')
    await fs.writeFile(
      path.join(generatedRoot, 'workflows', 'index.md'),
      '# old workflows\n',
      'utf-8'
    )

    const result = await generateWiki(projectRoot, projectId)
    expect(result.filesRemoved).toBeGreaterThanOrEqual(7)
    const manifest = JSON.parse(
      await fs.readFile(path.join(generatedRoot, '.manifest.json'), 'utf-8')
    ) as Record<string, string>

    expect(manifest[VAULT_HOME_FILE]).toBeDefined()
    expect(manifest[ANALYSIS_MAP_FILE]).toBeDefined()
    expect(manifest[RELEASE_HISTORY_FILE]).toBeUndefined()
    expect(Object.keys(manifest)).not.toContain('index.md')
    expect(Object.keys(manifest)).not.toContain('analysis/index.md')
    expect(Object.keys(manifest)).not.toContain('specs/_index.md')
    expect(Object.keys(manifest)).not.toContain('workflows/index.md')
    await expect(fs.stat(path.join(vaultRoot, 'README.md'))).rejects.toThrow()
    await expect(fs.stat(path.join(vaultRoot, 'captured', 'README.md'))).rejects.toThrow()
    await expect(fs.stat(path.join(vaultRoot, 'workflows', 'README.md'))).rejects.toThrow()

    const decisionRel = Object.keys(manifest).find(
      (rel) => rel.startsWith('memory/decision/') && rel.endsWith('.md')
    )
    expect(decisionRel).toBeDefined()
    const decision = await fs.readFile(path.join(generatedRoot, decisionRel!), 'utf-8')
    expect(decision).toContain('## Related context')
    expect(decision).toContain('**Domain:** [[tags/domain|memory]]')
    expect(decision).toContain('**Feature:** [[tags/feature|vault]]')
    expect(decision).toContain('second-brain edges')

    const tags = await fs.readFile(path.join(generatedRoot, 'tags.md'), 'utf-8')
    expect(tags).toContain('Relationship Map')
  })

  it('A.2 re-regen with no DB changes writes 0 files', async () => {
    llmAnalysisStorage.save(
      projectId,
      makeAnalysis({
        analyzedAt: '2026-01-10T00:00:00Z',
        patterns: [{ name: 'Foo', description: 'foo desc' }],
      })
    )
    appendMemoryEvent('decision', 'we picked SQLite')

    const first = await generateWiki(projectRoot, projectId)
    expect(first.filesWritten).toBeGreaterThan(0)

    const second = await generateWiki(projectRoot, projectId)

    // The load-bearing assertion: the manifest diff catches a no-op
    // regen so the disk is not churned. (`first.filesWritten` may
    // include the top-level README which is written once but not
    // tracked in the manifest, so we don't compare counts directly —
    // what matters is that the second run writes nothing.)
    expect(second.filesWritten).toBe(0)
    expect(second.filesSkipped).toBeGreaterThan(0)
    expect(second.filesRemoved).toBe(0)
  })

  it('A.2c self-heals a deleted vault file even when inputs are unchanged', async () => {
    appendMemoryEvent('decision', 'we picked SQLite')
    await generateWiki(projectRoot, projectId)
    const indexPath = path.join(generatedRoot, VAULT_HOME_FILE)
    expect(await fs.stat(indexPath).then(() => true)).toBe(true)

    // Simulate a stale/partially-wiped vault: delete the semantic home
    // WITHOUT changing any DB input. The old behaviour trusted the manifest +
    // fingerprint and never recreated it ("context queda stale").
    await fs.rm(indexPath)
    const healed = await generateWiki(projectRoot, projectId)
    expect(healed.filesWritten).toBeGreaterThan(0)
    expect(await fs.readFile(indexPath, 'utf-8')).toContain('Project Context')
  })

  it('A.2b skips DB queries entirely when fingerprint matches (fast path)', async () => {
    llmAnalysisStorage.save(
      projectId,
      makeAnalysis({
        analyzedAt: '2026-01-10T00:00:00Z',
        patterns: [{ name: 'Foo', description: 'foo desc' }],
      })
    )
    await generateWiki(projectRoot, projectId)

    // Verify the fingerprint sidecar exists.
    const fp = await fs.readFile(path.join(generatedRoot, '.regen-fingerprint'), 'utf-8')
    expect(fp).toMatch(/^v2\|/)

    // Spy on the storage layer; on a no-op regen the fast path must
    // return BEFORE invoking any of these.
    const recallSpy = spyOn(projectMemory, 'recall')
    const llmSpy = spyOn(llmAnalysisStorage, 'getAllFull')
    try {
      const r = await generateWiki(projectRoot, projectId)
      expect(r.filesWritten).toBe(0)
      expect(r.filesSkipped).toBeGreaterThan(0)
      expect(recallSpy).not.toHaveBeenCalled()
      expect(llmSpy).not.toHaveBeenCalled()
    } finally {
      recallSpy.mockRestore()
      llmSpy.mockRestore()
    }
  })

  it('A.3 adding one memory entry leaves analysis/* files untouched', async () => {
    llmAnalysisStorage.save(
      projectId,
      makeAnalysis({
        analyzedAt: '2026-01-10T00:00:00Z',
        patterns: [{ name: 'Foo', description: 'foo desc' }],
      })
    )
    appendMemoryEvent('decision', 'first decision')
    await generateWiki(projectRoot, projectId)

    const conceptPath = path.join(generatedRoot, 'analysis', 'patterns', 'foo.md')
    const conceptMtimeBefore = (await fs.stat(conceptPath)).mtimeMs

    // Force a measurable mtime gap so a "did the file change?" check
    // can't false-positive on same-tick writes.
    await new Promise((r) => setTimeout(r, 20))

    appendMemoryEvent('decision', 'second decision — should rewrite memory files only')
    const result = await generateWiki(projectRoot, projectId)

    expect(result.filesWritten).toBeGreaterThan(0)
    expect(result.filesSkipped).toBeGreaterThan(0)

    const conceptMtimeAfter = (await fs.stat(conceptPath)).mtimeMs
    expect(conceptMtimeAfter).toBe(conceptMtimeBefore)
  })
})

// B. Concept-level historical preservation

describe('Wiki Generator — concept history', () => {
  it('B.1 keeps firstSeen, advances lastSeen, grows seenIn across re-saves', async () => {
    llmAnalysisStorage.save(
      projectId,
      makeAnalysis({
        analyzedAt: '2026-01-10T00:00:00Z',
        commitHash: 'aaaa1111',
        patterns: [{ name: 'Hono validation via Context7', description: 'v1' }],
      })
    )
    await generateWiki(projectRoot, projectId)

    const fmA = await readFrontmatter('analysis/patterns/hono-validation-via-context7.md')
    expect(fmA.firstSeen).toBe('2026-01-10')
    expect(fmA.lastSeen).toBe('2026-01-10')
    expect(fmA.seenIn).toBe('1')
    expect(fmA.stillActive).toBe('true')

    // A1 becomes 'superseded'; A2 becomes 'active' but contains the
    // same concept with an updated description.
    llmAnalysisStorage.save(
      projectId,
      makeAnalysis({
        analyzedAt: '2026-02-15T00:00:00Z',
        commitHash: 'bbbb2222',
        patterns: [{ name: 'Hono validation via Context7', description: 'v2 (refined)' }],
      })
    )
    await generateWiki(projectRoot, projectId)

    const fmB = await readFrontmatter('analysis/patterns/hono-validation-via-context7.md')
    expect(fmB.firstSeen).toBe('2026-01-10')
    expect(fmB.lastSeen).toBe('2026-02-15')
    expect(fmB.seenIn).toBe('2')
    expect(fmB.stillActive).toBe('true')

    // The concept body should reflect the latest description, not the original.
    const body = await fs.readFile(
      path.join(generatedRoot, 'analysis', 'patterns', 'hono-validation-via-context7.md'),
      'utf-8'
    )
    expect(body).toContain('v2 (refined)')
  })

  it('B.2 preserves concept marked inactive when the latest analysis omits it', async () => {
    llmAnalysisStorage.save(
      projectId,
      makeAnalysis({
        analyzedAt: '2026-01-10T00:00:00Z',
        patterns: [{ name: 'Foo', description: 'foo' }],
      })
    )
    await generateWiki(projectRoot, projectId)

    // Latest analysis no longer contains "Foo" — it should still survive
    // in the vault, just marked inactive. Trace must not be lost.
    llmAnalysisStorage.save(
      projectId,
      makeAnalysis({
        analyzedAt: '2026-02-15T00:00:00Z',
        patterns: [{ name: 'Bar', description: 'bar' }],
      })
    )
    await generateWiki(projectRoot, projectId)

    const fooFm = await readFrontmatter('analysis/patterns/foo.md')
    expect(fooFm.firstSeen).toBe('2026-01-10')
    expect(fooFm.lastSeen).toBe('2026-01-10')
    expect(fooFm.stillActive).toBe('false')

    const barFm = await readFrontmatter('analysis/patterns/bar.md')
    expect(barFm.stillActive).toBe('true')
  })

  it('B.3 concept slug is stable across regens', async () => {
    const name = 'CLI-as-context-provider (--md flag)'
    llmAnalysisStorage.save(
      projectId,
      makeAnalysis({
        analyzedAt: '2026-01-10T00:00:00Z',
        patterns: [{ name, description: 'v1' }],
      })
    )
    await generateWiki(projectRoot, projectId)

    const before = await fs.readdir(path.join(generatedRoot, 'analysis', 'patterns'))

    llmAnalysisStorage.save(
      projectId,
      makeAnalysis({
        analyzedAt: '2026-02-15T00:00:00Z',
        patterns: [{ name, description: 'v2' }],
      })
    )
    await generateWiki(projectRoot, projectId)

    const after = await fs.readdir(path.join(generatedRoot, 'analysis', 'patterns'))
    expect(after.sort()).toEqual(before.sort())
  })
})
