/**
 * Optional semantic-search layer — offline tests against a fake provider.
 *
 * Pins: disabled-by-default (no provider → inert), cosine math, store +
 * cosine-ranked semanticSearch, and backfill idempotency. No network: the
 * provider is injected, so these never touch a real embeddings endpoint.
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

describe('embeddings — disabled by default', () => {
  it('resolveProvider is null without config / provider / model', () => {
    expect(resolveProvider(null)).toBeNull()
    expect(resolveProvider({ projectId: 'x', dataPath: '' } as LocalConfig)).toBeNull()
    expect(
      resolveProvider({ embeddings: { provider: 'openai-compatible' } } as LocalConfig)
    ).toBeNull()
  })

  it('isEnabled false without a provider; true when configured', () => {
    expect(embeddingService.isEnabled(null)).toBe(false)
    expect(embeddingService.isEnabled(enabledConfig)).toBe(true)
  })

  it('semanticSearch returns [] when disabled', async () => {
    const out = await embeddingService.semanticSearch(projectId, 'anything', {
      projectId: 'x',
      dataPath: '',
    } as LocalConfig)
    expect(out).toHaveLength(0)
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
