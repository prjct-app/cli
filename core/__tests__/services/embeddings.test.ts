/**
 * Semantic-search layer — offline tests.
 *
 * Pins: provider resolution (explicit endpoint vs the always-on local
 * default), the local subword embedder (determinism, normalization,
 * morphological ranking, end-to-end), cosine math, cosine-ranked
 * semanticSearch, and backfill idempotency. No network: the HTTP path uses an
 * injected fake; the local path is pure-JS.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import { projectMemory } from '../../memory/project-memory'
import {
  cosineSimilarity,
  type EmbeddingProvider,
  embeddingService,
  LOCAL_EMBEDDING_MODEL,
  LocalSubwordEmbeddingProvider,
  resolveActiveProvider,
  resolveProvider,
} from '../../services/embeddings'
import prjctDb from '../../storage/database'
import type { LocalConfig } from '../../types/config'

let tmpRoot: string
let projectId: string

const origGlobal = pathManager.getGlobalProjectPath.bind(pathManager)
const origStorage = pathManager.getStoragePath.bind(pathManager)
const origFile = pathManager.getFilePath.bind(pathManager)

const NOW = '2026-05-30T00:00:00.000Z'

/** Deterministic, offline provider: maps known text → known vector. */
class FakeProvider implements EmbeddingProvider {
  readonly model = 'fake-1'
  constructor(private readonly map: Record<string, number[]>) {}
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.map[t] ?? [0, 0, 0, 1])
  }
}

const enabledConfig: LocalConfig = {
  projectId: 'x',
  dataPath: '',
  embeddings: { provider: 'openai-compatible', model: 'fake-1', baseUrl: 'http://x/v1' },
} as LocalConfig

function write(type: string, content: string, tags: Record<string, string> = {}): string {
  prjctDb.appendEvent(projectId, `memory.remember.${type}`, {
    content,
    tags,
    provenance: 'declared',
  })
  const latest = projectMemory.recall(projectId, { limit: 1, dedupeByKey: false })
  return latest[0]?.id ?? ''
}

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-embed-'))
  projectId = `test-embed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  pathManager.getGlobalProjectPath = (id: string) => path.join(tmpRoot, id)
  pathManager.getStoragePath = (id: string, filename: string) =>
    path.join(tmpRoot, id, 'storage', filename)
  pathManager.getFilePath = (id: string, layer: string, filename: string) =>
    path.join(tmpRoot, id, layer, filename)
})

afterEach(async () => {
  pathManager.getGlobalProjectPath = origGlobal
  pathManager.getStoragePath = origStorage
  pathManager.getFilePath = origFile
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
})

describe('embeddings — provider resolution', () => {
  it('resolveProvider (explicit only) is null without config / provider / model', () => {
    expect(resolveProvider(null)).toBeNull()
    expect(resolveProvider({ projectId: 'x', dataPath: '' } as LocalConfig)).toBeNull()
    expect(
      resolveProvider({ embeddings: { provider: 'openai-compatible' } } as LocalConfig)
    ).toBeNull()
  })

  it('resolveActiveProvider falls back to the local default (never null)', () => {
    expect(resolveActiveProvider(null)).toBeInstanceOf(LocalSubwordEmbeddingProvider)
    expect(resolveActiveProvider(null).model).toBe(LOCAL_EMBEDDING_MODEL)
    // An explicit endpoint upgrades over the local default.
    expect(resolveActiveProvider(enabledConfig).model).toBe('fake-1')
  })

  it('isEnabled is always true (semantic on for everyone)', () => {
    expect(embeddingService.isEnabled(null)).toBe(true)
    expect(embeddingService.isEnabled(enabledConfig)).toBe(true)
  })

  it('semanticSearch returns [] when nothing is embedded yet (lexical fallback)', async () => {
    const out = await embeddingService.semanticSearch(projectId, 'anything', {
      projectId: 'x',
      dataPath: '',
    } as LocalConfig)
    expect(out).toHaveLength(0)
  })
})

describe('LocalSubwordEmbeddingProvider', () => {
  const local = new LocalSubwordEmbeddingProvider()

  it('produces a deterministic, L2-normalized 256-dim vector', async () => {
    const [a] = await local.embed(['authentication flow'])
    const [b] = await local.embed(['authentication flow'])
    expect(a).toHaveLength(256)
    expect(a).toEqual(b!) // deterministic
    const norm = Math.sqrt(a!.reduce((s, x) => s + x * x, 0))
    expect(norm).toBeCloseTo(1, 5)
  })

  it('scores morphologically-related text above unrelated text', async () => {
    const [q] = await local.embed(['authentication'])
    const [near] = await local.embed(['authenticate the user'])
    const [far] = await local.embed(['banana pricing spreadsheet'])
    expect(cosineSimilarity(q!, near!)).toBeGreaterThan(cosineSimilarity(q!, far!))
  })

  it('end-to-end: backfill + semanticSearch with the local default ranks the related entry first', async () => {
    const target = write('decision', 'migrate the sqlite database schema with a new migration')
    write('decision', 'style the react frontend button component')

    // No provider passed → uses the local default via resolveActiveProvider.
    const r = await embeddingService.backfill(
      projectId,
      { projectId, dataPath: '' } as LocalConfig,
      NOW
    )
    expect(r.embedded).toBe(2)

    const hits = await embeddingService.semanticSearch(
      projectId,
      'database migrations',
      { projectId, dataPath: '' } as LocalConfig,
      5
    )
    expect(hits[0]?.id).toBe(target)
  })
})

describe('cosineSimilarity', () => {
  it('is 1 for identical, 0 for orthogonal', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 5)
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 5)
  })
  it('is 0 against a zero vector (no NaN)', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0)
  })
})

describe('embeddings — backfill + semanticSearch', () => {
  it('ranks the nearest entry first and round-trips the stored vector', async () => {
    const a = write('decision', 'alpha')
    write('decision', 'beta')
    const provider = new FakeProvider({
      alpha: [1, 0, 0],
      beta: [0, 1, 0],
      'find the first one': [0.95, 0.05, 0],
    })

    const r = await embeddingService.backfill(projectId, enabledConfig, NOW, { provider })
    expect(r.embedded).toBe(2)

    const hits = await embeddingService.semanticSearch(
      projectId,
      'find the first one',
      enabledConfig,
      5,
      provider
    )
    expect(hits[0]?.id).toBe(a)
  })

  it('backfill is idempotent — a second run embeds nothing new', async () => {
    write('fact', 'one')
    write('fact', 'two')
    const provider = new FakeProvider({ one: [1, 0], two: [0, 1] })
    const first = await embeddingService.backfill(projectId, enabledConfig, NOW, { provider })
    expect(first.embedded).toBe(2)
    const second = await embeddingService.backfill(projectId, enabledConfig, NOW, { provider })
    expect(second.embedded).toBe(0)
  })
})
