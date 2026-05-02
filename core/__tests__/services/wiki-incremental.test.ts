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
import { generateWiki } from '../../services/wiki-generator'
import { prjctDb } from '../../storage/database'
import llmAnalysisStorage from '../../storage/llm-analysis-storage'
import type { LLMAnalysis, LLMPattern } from '../../types/llm-analysis'

// =============================================================================
// Sandbox
// =============================================================================

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
    JSON.stringify({ projectId, dataPath: '' }, null, 2)
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

// =============================================================================
// Helpers
// =============================================================================

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

function appendMemoryEvent(type: string, content: string): void {
  prjctDb.appendEvent(projectId, `memory.remember.${type}`, {
    content,
    tags: {},
    provenance: 'declared',
  })
}

// =============================================================================
// A. Manifest-based file diff
// =============================================================================

describe('Wiki Generator — manifest incrementality', () => {
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
    expect(manifest['index.md']).toBeDefined()
    expect(manifest['analysis/patterns/foo.md']).toBeDefined()
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

// =============================================================================
// B. Concept-level historical preservation
// =============================================================================

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
