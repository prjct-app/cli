/**
 * Semantic-search layer.
 *
 * Design constraints that shaped this:
 *   - ON by default, universally, with ZERO new dependency. The default
 *     provider is a pure-JS local embedder (feature-hashed character n-grams,
 *     see LocalSubwordEmbeddingProvider) — no model download, no native addon,
 *     no API key, no network. So "vectorized to the DB" is true for every user
 *     out of the box, not just those who configured an endpoint.
 *   - AUTO-UPGRADE: when a project configures an OpenAI-compatible endpoint
 *     (OpenAI, Ollama at `http://localhost:11434/v1`, LM Studio, …) that real
 *     model takes over — higher quality, same pipeline. The local embedder is
 *     the floor, not the ceiling.
 *   - NO vector database / native dependency. Vectors are packed Float32
 *     BLOBs in SQLite (`memory_embeddings`) and ranked with in-process cosine.
 *     For a project's hundreds–thousands of entries this is trivially fast and
 *     keeps prjct's zero-native-dep story intact.
 *
 * The provider is injectable so tests run fully offline against a fake.
 */

import { isModelMemory, type MemoryEntry, projectMemory } from '../../memory/project-memory'
import prjctDb from '../../storage/database'
import type { LocalConfig } from '../../types/config'
import { resolveGlobalEmbeddings } from './global'
import { getEmbeddingsKey } from './secure-key'

// Global BYOT config surface — re-exported so callers use one import path.
export {
  clearGlobalEmbeddings,
  DEFAULT_EMBEDDINGS_BASE_URL,
  DEFAULT_EMBEDDINGS_MODEL,
  detectBaseUrlFromKey,
  resolveGlobalEmbeddings,
  setGlobalEmbeddings,
} from './global'
/** Env var holding the bearer token for the embeddings endpoint (if any).
 *  Re-exported from secure-key so existing importers keep working. */
export { EMBEDDINGS_API_KEY_ENV } from './secure-key'

/** Produces one vector per input string, order-preserving. */
export interface EmbeddingProvider {
  readonly model: string
  /**
   * True for providers that compute in-process with no network/cost, so the
   * caller may embed inline (e.g. on every capture) instead of deferring to a
   * batched backfill. Remote/HTTP providers leave this falsy.
   */
  readonly isLocal?: boolean
  embed(texts: string[]): Promise<number[][]>
}

/**
 * Resolve a provider from config, or null when embeddings are disabled.
 * Disabled === no provider configured: the single switch the rest of the
 * code branches on.
 */
export function resolveProvider(config: LocalConfig | null | undefined): EmbeddingProvider | null {
  const e = config?.embeddings
  if (!e || !e.provider || !e.model) return null
  if (e.provider === 'openai-compatible') {
    return new HttpEmbeddingProvider(e.baseUrl ?? 'https://api.openai.com/v1', e.model, {
      authHeader: e.authHeader,
      authScheme: e.authScheme,
      extraHeaders: e.headers,
      query: e.query,
    })
  }
  return null
}

/**
 * Auth/transport knobs so the OpenAI-compatible path reaches providers that
 * deviate from the `Authorization: Bearer` default — Azure OpenAI (`api-key`
 * header + `api-version` query), gateways needing extra static headers, etc.
 * All optional; the defaults are exactly the OpenAI/OpenRouter/Ollama shape.
 */
export interface HttpAuthOptions {
  /** Header that carries the API key. Default `authorization`. */
  authHeader?: string
  /** Scheme/prefix before the key, e.g. `Bearer`. Empty string = raw key
   *  (Azure's `api-key: <key>`). Default `Bearer`. */
  authScheme?: string
  /** Extra static headers sent on every request. */
  extraHeaders?: Record<string, string>
  /** Raw query string appended to the URL, e.g. `api-version=2023-05-15`. */
  query?: string
}

/**
 * Build the `/embeddings` request (URL + fetch init) for an OpenAI-compatible
 * endpoint. Pure and exported so the auth/header/query wiring is unit-testable
 * without a network round-trip.
 */
export function buildEmbeddingsRequest(
  baseUrl: string,
  model: string,
  texts: string[],
  key: string | null,
  auth: HttpAuthOptions = {}
): { url: string; init: RequestInit } {
  const root = baseUrl.replace(/\/+$/, '')
  const q = auth.query?.trim().replace(/^\?/, '')
  const url = `${root}/embeddings${q ? `?${q}` : ''}`

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(auth.extraHeaders ?? {}),
  }
  if (key) {
    const headerName = auth.authHeader?.trim() || 'authorization'
    const scheme = auth.authScheme ?? 'Bearer'
    headers[headerName] = scheme ? `${scheme} ${key}` : key
  }

  return {
    url,
    init: { method: 'POST', headers, body: JSON.stringify({ model, input: texts }) },
  }
}

/** OpenAI-compatible `/embeddings` provider over `fetch` (no SDK). */
export class HttpEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly baseUrl: string,
    public readonly model: string,
    private readonly auth: HttpAuthOptions = {}
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    const key = await getEmbeddingsKey()
    const { url, init } = buildEmbeddingsRequest(this.baseUrl, this.model, texts, key, this.auth)
    const res = await fetch(url, init)
    if (!res.ok) {
      throw new Error(`embeddings endpoint ${res.status}: ${await res.text().catch(() => '')}`)
    }
    const json = (await res.json()) as { data?: Array<{ embedding: number[] }> }
    return (json.data ?? []).map((d) => d.embedding)
  }
}

// Local default provider — zero-dependency subword embedding.

/** Model tag stamped on locally-computed vectors. Bump the suffix to
 *  invalidate every local vector if the algorithm below changes. */
export const LOCAL_EMBEDDING_MODEL = 'local-subword-v1'
const LOCAL_DIM = 256
const MAX_TOKENS = 800 // cap work on pathologically long entries

/** FNV-1a 32-bit — small, fast, well-distributed string hash. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Character n-grams of `s` for n in [min,max]; falls back to the whole
 *  string when it is shorter than `min`. */
function charNGrams(s: string, min: number, max: number): string[] {
  const grams: string[] = []
  if (s.length < min) {
    grams.push(s)
    return grams
  }
  for (let n = min; n <= max; n++) {
    for (let i = 0; i + n <= s.length; i++) grams.push(s.slice(i, i + n))
  }
  return grams
}

/**
 * Embed one string into an L2-normalized LOCAL_DIM vector via the hashing
 * trick over boundary-wrapped character n-grams (n=3..5) plus the whole token.
 * Memory content is English by convention (see the skill's CONTENT LANGUAGE
 * rule), which keeps semantics clean; the tokenizer stays Unicode-safe so code
 * identifiers (file paths, function names) and any stray non-English token
 * still contribute. A signed hash spreads collisions across buckets.
 */
function embedLocal(text: string): number[] {
  const acc = new Float64Array(LOCAL_DIM)
  const tokens = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, MAX_TOKENS)
  for (const tok of tokens) {
    const grams = charNGrams(`<${tok}>`, 3, 5)
    grams.push(tok) // whole-token feature in addition to its n-grams
    for (const g of grams) {
      const h = fnv1a(g)
      const bucket = h % LOCAL_DIM
      const sign = h & 0x10000 ? 1 : -1 // sign bit independent of the bucket bits
      acc[bucket] += sign
    }
  }
  let norm = 0
  for (let i = 0; i < LOCAL_DIM; i++) norm += acc[i] * acc[i]
  norm = Math.sqrt(norm) || 1
  const out = new Array<number>(LOCAL_DIM)
  for (let i = 0; i < LOCAL_DIM; i++) out[i] = acc[i] / norm
  return out
}

/**
 * The always-available default provider. Pure-JS, deterministic, no network.
 * Captures morphological / substring similarity (auth≈authentication,
 * sqlite≈SQLite) that exact-token BM25 misses, and yields a continuous score
 * for ranking + the vector substrate the bidirectional-vault pipeline needs.
 * NOT deep synonymy — that is what the HTTP auto-upgrade buys.
 */
export class LocalSubwordEmbeddingProvider implements EmbeddingProvider {
  readonly model = LOCAL_EMBEDDING_MODEL
  readonly isLocal = true
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => embedLocal(t))
  }
}

/**
 * The provider actually used at runtime, in precedence order:
 *   1. a per-project endpoint (`config.embeddings`) — explicit override;
 *   2. the GLOBAL BYOT endpoint (`prjct embeddings set`) — one key, all
 *      projects, the real-model upgrade;
 *   3. the in-process local subword embedder — the always-available default.
 * Unlike `resolveProvider` this NEVER returns null — semantic search is on for
 * everyone.
 */
export function resolveActiveProvider(config: LocalConfig | null | undefined): EmbeddingProvider {
  const explicit = resolveProvider(config)
  if (explicit) return explicit
  const global = resolveGlobalEmbeddings()
  if (global)
    return new HttpEmbeddingProvider(global.baseUrl, global.model, {
      authHeader: global.authHeader,
      authScheme: global.authScheme,
      extraHeaders: global.extraHeaders,
      query: global.query,
    })
  return new LocalSubwordEmbeddingProvider()
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
  /**
   * Always true now: the local default provider makes semantic search
   * available to every project. Kept as a method so callers read intent
   * ("is semantic available?") and so a future kill-switch has one home.
   */
  isEnabled(_config: LocalConfig | null | undefined): boolean {
    return true
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
    const provider = opts.provider ?? resolveActiveProvider(config)
    const batchSize = opts.batchSize ?? 64
    const all = projectMemory.allEntriesForIndex(projectId)

    // Selectivity (RAG north star): embed only entries that MODEL the
    // project/developer, never bulk-vectorize telemetry noise. Prune any noise
    // vectors a prior (indiscriminate) backfill stored, so semantic recall
    // stops surfacing hot-file churn / raw friction.
    const model = all.filter((e) => isModelMemory(e))
    this.pruneNonModelVectors(
      projectId,
      all.filter((e) => !isModelMemory(e)).map((e) => e.id)
    )

    const have = this.embeddedIds(projectId, provider.model)
    const todo = model.filter((e) => !have.has(e.id) && e.content.trim().length > 0)

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
    return { embedded, skipped: model.length - todo.length, total: model.length }
  },

  /** Delete stored vectors for entries that are no longer model-worthy
   *  (e.g. noise embedded by an older indiscriminate backfill). Best-effort. */
  pruneNonModelVectors(projectId: string, noiseIds: string[]): void {
    if (noiseIds.length === 0) return
    try {
      const placeholders = noiseIds.map(() => '?').join(',')
      prjctDb.run(
        projectId,
        `DELETE FROM memory_embeddings WHERE memory_id IN (${placeholders})`,
        ...noiseIds
      )
    } catch {
      /* best-effort — a stale noise vector is harmless until the next run */
    }
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
    const p = provider ?? resolveActiveProvider(config)
    if (!query.trim()) return []
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
