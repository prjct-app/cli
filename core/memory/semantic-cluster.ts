/**
 * Semantic cluster for memory surfaces — collapse cross-language / near-
 * paraphrase equivalents into one primary (fullest) row + seen_in_N.
 *
 * Pure + deterministic + local embeddings only (0 network). Safe for brief
 * assembly on every recall path.
 *
 * Cluster rule (AND):
 *   1. cosine(local embed) >= threshold (stricter without entities)
 *   2. shared key entities (file, RPC/snake id, ALLCAPS token, UUID, …)
 *      — OR exact content fingerprint
 *
 * Over-collapse mitigation: entity gate is mandatory unless fingerprint matches.
 * Near-but-distinct facts without shared entities never merge.
 *
 * ── Fase 0 acceptance contracts ──────────────────────────────────────────
 *
 * T1 TRACEABILITY (post-cluster survivor MUST preserve all sources):
 *   - `cluster_sources`  — ALL member mem_ids, primary first (auditable set)
 *   - `cluster_members`  — non-primary ids only (compat / "the collapsed ones")
 *   - `seen_in_N`        — |members| (importance, not noise)
 *   - `cluster_id`       — stable `c_<primaryId>`
 *   Brief/compact lines MUST surface `sources=` when seen_in_N > 1 so a PO
 *   or eng-lead can `prjct context memory mem_N` on ANY corroborating capture.
 *   Storage rows are never deleted by clustering — only the *presentation*
 *   collapses. Full/by-id format remains unclustered for forensic audit.
 *
 * LANGUAGE SURFACE (PRD §7.3):
 *   Storage keeps original language (no silent DB rewrite — audit intact).
 *   Brief presentation language unify is DEFERRED to the product layer
 *   (tech→product / intake). When a cluster spans languages we tag
 *   `cluster_langs` and `surface_lang=store-original` so the brief is honest
 *   that survivors may remain bilingual until that layer lands. Do not
 *   machine-translate here without an explicit product decision.
 *
 * Demote interaction: precision may retype gotcha→context / red-herring
 * before recall. Clustering is within a single type only, so a demoted
 * context row never re-joins a gotcha cluster (no promotion by fullness).
 */

import { cosineSimilarity, embedLocalText } from '../services/embeddings'
import { memoryFingerprint } from './content-fingerprint'
import type { MemoryEntry } from './entries'

/** High bar when no/weak entity overlap (local subword only). */
export const CLUSTER_SIM_STRICT = 0.88

/**
 * Lower bar when ≥1 strong shared entity — needed for ES↔EN pairs of the
 * same fact ("No era RLS" / "It wasn't RLS") where local embed sim is weak.
 */
export const CLUSTER_SIM_WITH_ENTITY = 0.52

/**
 * When ≥2 strong anchors agree (RPC + RLS, file + error code), allow a
 * lower cosine — local subword often scores ES↔EN paraphrases ~0.40.
 */
export const CLUSTER_SIM_MULTI_ENTITY = 0.38

/** Ignore tiny tokens as entities. */
const MIN_ENTITY_LEN = 3

/** Strong anchors: paths, snake RPCs, multi-word, codes like rls/jwt. */
export function isStrongEntity(e: string): boolean {
  if (e.length < MIN_ENTITY_LEN) return false
  if (e.includes('/') || e.includes('.') || e.includes('_') || e.includes(' ')) return true
  if (e.length >= 10) return true
  // Short product/security codes that are high-signal across languages
  return ['rls', 'jwt', 'rpc', 'csrf', 'cors', 'oauth', 'sso'].includes(e)
}

export interface MemoryCluster {
  /** Fullest / preferred entry shown on the surface. */
  primary: MemoryEntry
  /** All members including primary. */
  members: MemoryEntry[]
  seenInN: number
  sharedEntities: string[]
  clusterId: string
}

/**
 * T1: ordered source ids for a cluster — primary first, then others stable
 * by original member order. Always includes every corroborating capture.
 */
export function clusterSourceIds(cluster: MemoryCluster): string[] {
  const primaryId = cluster.primary.id
  const rest = cluster.members.map((m) => m.id).filter((id) => id !== primaryId)
  return [primaryId, ...rest]
}

/**
 * Coarse language tags for honesty on multi-lang clusters (not a full detector).
 * Used only for `cluster_langs` metadata — never rewrites content.
 */
export function detectContentLangHints(text: string): string[] {
  const t = (text ?? '').toLowerCase()
  const hints: string[] = []
  // Spanish function words / patterns common in our vault
  if (
    /\b(el|la|los|las|de|que|no|era|fue|para|con|por|una|esto|esta|cómo|como)\b/.test(t) ||
    /[áéíóúñ¿¡]/.test(t)
  ) {
    hints.push('es')
  }
  if (
    /\b(the|was|were|wasn't|with|from|that|this|and|for|not|is|are|it)\b/.test(t) ||
    /\b(security definer|bypass)\b/.test(t)
  ) {
    hints.push('en')
  }
  if (hints.length === 0) hints.push('und')
  return [...new Set(hints)]
}

/** Union of language hints across cluster members. */
export function clusterLangHints(members: MemoryEntry[]): string[] {
  const set = new Set<string>()
  for (const m of members) {
    for (const h of detectContentLangHints(m.content)) set.add(h)
  }
  return [...set].sort()
}

/**
 * Build the T1 tag payload that every clustered survivor carries.
 * Guarantees: all source ids recoverable; multi-lang flagged, not translated.
 */
export function buildClusterSurfaceTags(cluster: MemoryCluster): Record<string, string> {
  const sources = clusterSourceIds(cluster)
  const membersOnly = sources.slice(1)
  const langs = clusterLangHints(cluster.members)
  const tags: Record<string, string> = {
    seen_in_N: String(cluster.seenInN),
    cluster_id: cluster.clusterId,
  }
  if (cluster.seenInN > 1) {
    // Primary-first full audit set (T1 contract — never drop corroborating ids)
    tags.cluster_sources = sources.join(',')
    // Non-primary only (legacy / "who was collapsed")
    tags.cluster_members = membersOnly.join(',')
    tags.surface_lang = 'store-original'
    if (langs.length > 0) tags.cluster_langs = langs.join(',')
    if (langs.length > 1) {
      // Explicit: bilingual survivor is allowed until product-layer normalize
      tags.lang_normalize = 'deferred-product-layer'
    }
  }
  return tags
}

/**
 * Extract key entities used as the cluster gate (not a full NER).
 * Conservative: paths, long identifiers, ALLCAPS codes, UUIDs, mem refs.
 */
export function extractKeyEntities(text: string): Set<string> {
  const out = new Set<string>()
  const s = text ?? ''

  for (const m of s.matchAll(/\b(?:[\w@.-]+\/)+[\w.-]+\.\w{1,8}\b/g)) {
    out.add(m[0]!.toLowerCase())
  }
  for (const m of s.matchAll(/\b[\w-]+\.(ts|tsx|js|jsx|mjs|cjs|py|sql|go|rs|md|json)\b/gi)) {
    out.add(m[0]!.toLowerCase())
  }
  // snake_case / long identifiers (RPC, helpers)
  for (const m of s.matchAll(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+){1,}\b/gi)) {
    if (m[0]!.length >= 6) out.add(m[0]!.toLowerCase())
  }
  // camelCase long
  for (const m of s.matchAll(/\b[a-z]+[A-Z][a-zA-Z0-9]{3,}\b/g)) {
    out.add(m[0]!.toLowerCase())
  }
  // ALLCAPS codes (RLS, JWT, RPC…)
  for (const m of s.matchAll(/\b[A-Z]{2,8}\b/g)) {
    out.add(m[0]!.toLowerCase())
  }
  // UUIDs
  for (const m of s.matchAll(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
  )) {
    out.add(m[0]!.toLowerCase())
  }
  // mem_N cross-refs
  for (const m of s.matchAll(/\bmem[_-]\d+\b/gi)) {
    out.add(m[0]!.toLowerCase().replace('-', '_'))
  }
  // Security / product anchors that appear in multi-language traps
  for (const anchor of [
    'security definer',
    'security invoker',
    'row level security',
    'router.refresh',
  ]) {
    if (s.toLowerCase().includes(anchor)) out.add(anchor)
  }

  // Drop ultra-generic tokens
  for (const noise of ['the', 'and', 'for', 'with', 'from', 'this', 'that', 'http', 'https']) {
    out.delete(noise)
  }
  return out
}

export function sharedEntities(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = []
  for (const x of a) {
    if (x.length >= MIN_ENTITY_LEN && b.has(x)) out.push(x)
  }
  return out.sort()
}

/** Prefer longer declared bodies as the surface primary. */
export function fullnessScore(e: Pick<MemoryEntry, 'content' | 'provenance'>): number {
  const len = (e.content ?? '').trim().length
  const provBonus =
    e.provenance === 'declared'
      ? 80
      : e.provenance === 'extracted'
        ? 40
        : e.provenance === 'inferred'
          ? 0
          : 20
  return len + provBonus
}

function pickPrimary(members: MemoryEntry[]): MemoryEntry {
  let best = members[0]!
  let bestScore = fullnessScore(best)
  for (let i = 1; i < members.length; i++) {
    const m = members[i]!
    const s = fullnessScore(m)
    if (s > bestScore) {
      best = m
      bestScore = s
    }
  }
  return best
}

/**
 * Should two entries collapse into one cluster?
 * Same type required (gotcha≠decision).
 */
export function shouldClusterPair(
  a: Pick<MemoryEntry, 'type' | 'content' | 'id'>,
  b: Pick<MemoryEntry, 'type' | 'content' | 'id'>,
  opts?: {
    sim?: number
    entitiesA?: Set<string>
    entitiesB?: Set<string>
  }
): { cluster: boolean; sim: number; entities: string[] } {
  if (a.type !== b.type) return { cluster: false, sim: 0, entities: [] }
  if (a.id && b.id && a.id === b.id) return { cluster: true, sim: 1, entities: [] }

  const fpA = memoryFingerprint(a.content)
  const fpB = memoryFingerprint(b.content)
  if (fpA === fpB) {
    return { cluster: true, sim: 1, entities: ['*fingerprint*'] }
  }

  const entA = opts?.entitiesA ?? extractKeyEntities(a.content)
  const entB = opts?.entitiesB ?? extractKeyEntities(b.content)
  const shared = sharedEntities(entA, entB)

  const sim = opts?.sim ?? cosineSimilarity(embedLocalText(a.content), embedLocalText(b.content))

  const strongShared = shared.filter(isStrongEntity)
  if (strongShared.length >= 2 && sim >= CLUSTER_SIM_MULTI_ENTITY) {
    return { cluster: true, sim, entities: shared }
  }
  if (strongShared.length >= 1 && sim >= CLUSTER_SIM_WITH_ENTITY) {
    return { cluster: true, sim, entities: shared }
  }
  // Strict path without entities is intentionally rare for cross-lang — avoid
  // merging "auth timeout" with "auth retry" just because subword sim is high.
  if (shared.length === 0 && sim >= CLUSTER_SIM_STRICT) {
    // Require moderate token Jaccard as secondary gate
    const ja = new Set(
      a.content
        .toLowerCase()
        .split(/[^a-z0-9áéíóúñü]+/i)
        .filter((t) => t.length >= 4)
    )
    const jb = new Set(
      b.content
        .toLowerCase()
        .split(/[^a-z0-9áéíóúñü]+/i)
        .filter((t) => t.length >= 4)
    )
    let inter = 0
    for (const t of ja) if (jb.has(t)) inter++
    const union = ja.size + jb.size - inter || 1
    const jaccard = inter / union
    if (jaccard >= 0.45) return { cluster: true, sim, entities: [] }
  }

  return { cluster: false, sim, entities: shared }
}

/**
 * Greedy union-find cluster within a flat entry list (typically one type).
 */
export function clusterMemoryEntries(entries: MemoryEntry[]): MemoryCluster[] {
  if (entries.length === 0) return []
  if (entries.length === 1) {
    const e = entries[0]!
    return [
      {
        primary: e,
        members: [e],
        seenInN: 1,
        sharedEntities: [],
        clusterId: `c_${e.id}`,
      },
    ]
  }

  const n = entries.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => {
    let p = i
    while (parent[p] !== p) p = parent[p]!
    let x = i
    while (parent[x] !== x) {
      const next = parent[x]!
      parent[x] = p
      x = next
    }
    return p
  }
  const union = (i: number, j: number) => {
    const ri = find(i)
    const rj = find(j)
    if (ri !== rj) parent[rj] = ri
  }

  const entityCache = entries.map((e) => extractKeyEntities(e.content))
  const vectors = entries.map((e) => embedLocalText(e.content))
  const pairEntities = new Map<string, string[]>()

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(vectors[i]!, vectors[j]!)
      const r = shouldClusterPair(entries[i]!, entries[j]!, {
        sim,
        entitiesA: entityCache[i],
        entitiesB: entityCache[j],
      })
      if (r.cluster) {
        union(i, j)
        pairEntities.set(`${i}:${j}`, r.entities)
      }
    }
  }

  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    const g = groups.get(r) ?? []
    g.push(i)
    groups.set(r, g)
  }

  const clusters: MemoryCluster[] = []
  for (const idxs of groups.values()) {
    const members = idxs.map((i) => entries[i]!)
    const primary = pickPrimary(members)
    // Union of shared entities seen on any merged pair in the group
    const ent = new Set<string>()
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        const key = `${Math.min(idxs[a]!, idxs[b]!)}:${Math.max(idxs[a]!, idxs[b]!)}`
        for (const e of pairEntities.get(key) ?? []) {
          if (e !== '*fingerprint*') ent.add(e)
        }
      }
    }
    clusters.push({
      primary,
      members,
      seenInN: members.length,
      sharedEntities: [...ent].sort(),
      clusterId: `c_${primary.id}`,
    })
  }

  // Stable order: original primary appearance order among entries
  const orderIndex = new Map(entries.map((e, i) => [e.id, i]))
  clusters.sort((a, b) => (orderIndex.get(a.primary.id) ?? 0) - (orderIndex.get(b.primary.id) ?? 0))
  return clusters
}

/**
 * Collapse a mixed-type list: cluster within each type, return primaries
 * with T1 tags (cluster_sources / seen_in_N / …) for rendering + intake.
 *
 * Within-type only — demoted gotcha→context never re-clusters into gotcha.
 */
export function collapseEntriesForSurface(entries: MemoryEntry[]): {
  entries: MemoryEntry[]
  collapsedCount: number
  clusters: MemoryCluster[]
  /** True when any survivor carries multi-lang cluster_langs. */
  multiLangSurvivors: number
} {
  if (entries.length <= 1) {
    return { entries, collapsedCount: 0, clusters: [], multiLangSurvivors: 0 }
  }

  const byType = new Map<string, MemoryEntry[]>()
  for (const e of entries) {
    const list = byType.get(e.type) ?? []
    list.push(e)
    byType.set(e.type, list)
  }

  const out: MemoryEntry[] = []
  const allClusters: MemoryCluster[] = []
  let collapsedCount = 0
  let multiLangSurvivors = 0

  // Preserve first-seen type order from original list
  const typeOrder: string[] = []
  for (const e of entries) {
    if (!typeOrder.includes(e.type)) typeOrder.push(e.type)
  }

  for (const type of typeOrder) {
    const group = byType.get(type) ?? []
    const clusters = clusterMemoryEntries(group)
    for (const c of clusters) {
      allClusters.push(c)
      if (c.seenInN > 1) collapsedCount += c.seenInN - 1
      const clusterTags = buildClusterSurfaceTags(c)
      if ((clusterTags.cluster_langs ?? '').includes(',')) multiLangSurvivors++
      const tagged: MemoryEntry = {
        ...c.primary,
        tags: {
          ...c.primary.tags,
          ...clusterTags,
        },
      }
      out.push(tagged)
    }
  }

  return { entries: out, collapsedCount, clusters: allClusters, multiLangSurvivors }
}
