/**
 * Optional semantic-search layer (phase 3).
 *
 * Design constraints that shaped this:
 *   - OFF by default. With no `config.embeddings.provider`, every export
 *     here is inert and recall stays pure BM25/keyword — zero new runtime
 *     dependencies, zero network, zero behavior change.
 *   - NO vector database / native dependency. Vectors are packed Float32
 *     BLOBs in SQLite (`memory_embeddings`) and ranked with in-process
 *     cosine. For a project's hundreds–thousands of memory entries this is
 *     trivially fast and keeps prjct's fragile native-dep story unchanged.
 *   - Provider is an OpenAI-compatible `/embeddings` HTTP endpoint (OpenAI,
 *     Ollama, LM Studio, …) called with plain `fetch` — no SDK in the
 *     bundle. The API key, when needed, comes from the environment, never
 *     from committed config.
 *
 * The provider is injectable so tests run fully offline against a fake.
 */

import { type MemoryEntry, projectMemory } from '../../memory/project-memory'
import prjctDb from '../../storage/database'
import type { LocalConfig } from '../../types/config'

/** Produces one vector per input string, order-preserving. */
export interface EmbeddingProvider {
  readonly model: string
  embed(texts: string[]): Promise<number[][]>
}

/** Env var holding the bearer token for the embeddings endpoint (if any). */
export const EMBEDDINGS_API_KEY_ENV = 'PRJCT_EMBEDDINGS_API_KEY'

/**
 * Resolve a provider from config, or null when embeddings are disabled.
 * Disabled === no provider configured: the single switch the rest of the
 * code branches on.
 */
export function resolveProvider(config: LocalConfig | null | undefined): EmbeddingProvider | null {
  const e = config?.embeddings
  if (!e || !e.provider || !e.model) return null
  if (e.provider === 'openai-compatible') {
    return new HttpEmbeddingProvider(e.baseUrl ?? 'https://api.openai.com/v1', e.model)
  }
  return null
}

/** OpenAI-compatible `/embeddings` provider over `fetch` (no SDK). */
export class HttpEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly baseUrl: string,
    public readonly model: string
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    const url = `${this.baseUrl.replace(/\/$/, '')}/embeddings`
    const key = process.env[EMBEDDINGS_API_KEY_ENV]
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    })
    if (!res.ok) {
      throw new Error(`embeddings endpoint ${res.status}: ${await res.text().catch(() => '')}`)
    }
    const json = (await res.json()) as { data?: Array<{ embedding: number[] }> }
    return (json.data ?? []).map((d) => d.embedding)
  }
}

// Vector <-> BLOB packing (Float32 little-endian).

function packVector(v: number[]): Buffer {
  return Buffer.from(new Float32Array(v).buffer)
}

function unpackVector(blob: Uint8Array): Float32Array {
  // Copy into a fresh, 4-byte-aligned buffer — a SQLite BLOB may arrive at a
  // non-aligned byteOffset, which Float32Array's view constructor rejects.
  const copy = Uint8Array.from(blob)
  return new Float32Array(copy.buffer, copy.byteOffset, Math.floor(copy.byteLength / 4))
}

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length)
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

interface EmbeddingRow {
  memory_id: string
  vector: Uint8Array
}

export const embeddingService = {
  /** True when this project has opted into a provider. */
  isEnabled(config: LocalConfig | null | undefined): boolean {
    return resolveProvider(config) !== null
  },

  /** Store one entry's vector (upsert). */
  store(
    projectId: string,
    memoryId: string,
    vector: number[],
    model: string,
    nowIso: string
  ): void {
    prjctDb.run(
      projectId,
      `INSERT INTO memory_embeddings (memory_id, vector, model, dims, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(memory_id) DO UPDATE SET
         vector = excluded.vector, model = excluded.model,
         dims = excluded.dims, created_at = excluded.created_at`,
      memoryId,
      packVector(vector),
      model,
      vector.length,
      nowIso
    )
  },

  /** Ids that already have an up-to-date vector for `model`. */
  embeddedIds(projectId: string, model: string): Set<string> {
    try {
      const rows = prjctDb.query<{ memory_id: string }>(
        projectId,
        'SELECT memory_id FROM memory_embeddings WHERE model = ?',
        model
      )
      return new Set(rows.map((r) => r.memory_id))
    } catch {
      return new Set()
    }
  },

  /**
   * Embed every memory entry that lacks a current-model vector, in batches.
   * Returns counts. Best-effort: a failed batch is skipped, not fatal.
   * `nowIso` is passed in (scripts can't call Date.now() deterministically).
   */
  async backfill(
    projectId: string,
    config: LocalConfig,
    nowIso: string,
    opts: { provider?: EmbeddingProvider; batchSize?: number } = {}
  ): Promise<{ embedded: number; skipped: number; total: number }> {
    const provider = opts.provider ?? resolveProvider(config)
    if (!provider) return { embedded: 0, skipped: 0, total: 0 }
    const batchSize = opts.batchSize ?? 64
    const all = projectMemory.allEntriesForIndex(projectId)
    const have = this.embeddedIds(projectId, provider.model)
    const todo = all.filter((e) => !have.has(e.id) && e.content.trim().length > 0)

    let embedded = 0
    for (let i = 0; i < todo.length; i += batchSize) {
      const batch = todo.slice(i, i + batchSize)
      try {
        const vectors = await provider.embed(batch.map((e) => e.content))
        batch.forEach((entry, j) => {
          const v = vectors[j]
          if (v && v.length > 0) {
            this.store(projectId, entry.id, v, provider.model, nowIso)
            embedded++
          }
        })
      } catch {
        // Skip this batch; the next backfill retries it.
      }
    }
    return { embedded, skipped: all.length - todo.length, total: all.length }
  },

  /**
   * Rank stored memory vectors by cosine similarity to `query`. Returns
   * resolved MemoryEntry rows, best-first. Empty when disabled, on provider
   * error, or when nothing has been embedded yet (caller falls back to BM25).
   */
  async semanticSearch(
    projectId: string,
    query: string,
    config: LocalConfig,
    limit = 10,
    provider?: EmbeddingProvider
  ): Promise<MemoryEntry[]> {
    const p = provider ?? resolveProvider(config)
    if (!p || !query.trim()) return []
    let qv: number[] | undefined
    try {
      ;[qv] = await p.embed([query])
    } catch {
      return []
    }
    if (!qv || qv.length === 0) return []

    let rows: EmbeddingRow[]
    try {
      rows = prjctDb.query<EmbeddingRow>(
        projectId,
        'SELECT memory_id, vector FROM memory_embeddings WHERE model = ?',
        p.model
      )
    } catch {
      return []
    }

    const ranked = rows
      .map((r) => ({ id: r.memory_id, score: cosineSimilarity(qv, unpackVector(r.vector)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    const out: MemoryEntry[] = []
    for (const r of ranked) {
      const entry = projectMemory.getById(projectId, r.id)
      if (entry) out.push(entry)
    }
    return out
  },
}
