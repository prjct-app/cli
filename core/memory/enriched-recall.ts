/**
 * Enriched recall — the ONE retrieval pipeline every agent surface uses.
 *
 * FTS5 BM25 first (relevance beats recency), recency-recall backfill,
 * optional semantic blend (when an embeddings provider is configured),
 * bounded usefulness rerank, one hop of relationship-link expansion, and
 * ship-success surface attribution.
 *
 * Extracted from `runMemoryTool` (the `prjct context memory` CLI path) so
 * the MCP tools stop serving a strictly WORSE retrieval: `prjct_mem_list`
 * used plain recency `recall()` — and subagents, who do the bulk of the
 * editing, reach memory through MCP. One pipeline, every surface.
 */

import configManager from '../infrastructure/config-manager'
import { embeddingService } from '../services/embeddings'
import { usefulnessService } from '../services/usefulness'
import { stateStorage } from '../storage/state-storage'
import type { MemoryEntry, MemoryType } from './entries'
import { isModelMemory, matchesTags } from './entries'
import { projectMemory } from './project-memory'

export interface EnrichedRecallOpts {
  topic?: string
  types?: MemoryType[]
  /** Require exact match on these k:v pairs (applies to every leg). */
  tags?: Record<string, string>
  limit?: number
  /** Append one hop of resolves/relates/supersedes links. Default true. */
  expandLinks?: boolean
}

export async function enrichedRecall(
  projectPath: string,
  projectId: string,
  opts: EnrichedRecallOpts = {}
): Promise<MemoryEntry[]> {
  const { topic, types, tags } = opts
  const limit = opts.limit ?? 30

  let entries: MemoryEntry[] = []
  if (topic) {
    const keywords = topic.split(/\s+/).filter(Boolean)
    try {
      let fts = projectMemory.searchFts(projectId, keywords, limit)
      if (types) fts = fts.filter((e) => types.includes(e.type as MemoryType))
      if (tags) fts = fts.filter((e) => matchesTags(e, tags))
      entries = fts
    } catch {
      entries = []
    }
  }

  // Backfill with recency + substring recall so a fresh/unindexed DB or a
  // cross-vocabulary topic still returns something.
  if (entries.length < limit) {
    const seen = new Set(entries.map((e) => e.id))
    const pool = projectMemory.recall(projectId, { topic, types, tags, limit })
    for (const e of pool) {
      if (seen.has(e.id)) continue
      entries.push(e)
      if (entries.length >= limit) break
    }
  }

  // Semantic layer (opt-in): blend cosine-ranked matches AHEAD of lexical
  // results so a cross-vocabulary hit ("oauth" → an entry about
  // "authentication") surfaces. Best-effort: failures leave BM25 standing.
  if (topic) {
    try {
      const config = await configManager.readConfig(projectPath)
      if (config && embeddingService.isEnabled(config)) {
        const semantic = await embeddingService.semanticSearch(projectId, topic, config, 10)
        if (semantic.length > 0) {
          const seen = new Set(entries.map((e) => e.id))
          let fresh = semantic.filter((e) => !seen.has(e.id))
          if (types) fresh = fresh.filter((e) => types.includes(e.type as MemoryType))
          if (tags) fresh = fresh.filter((e) => matchesTags(e, tags))
          entries = [...fresh, ...entries].slice(0, limit)
        }
      }
    } catch {
      /* best-effort — lexical results stand */
    }
  }

  // Clean the RAG: drop machine telemetry noise (raw friction quotes,
  // hot-file churn counters) so a recall returns project KNOWLEDGE, not basura.
  // Retrocompatible + non-destructive — the rows stay (audit / developer.md),
  // they just don't surface as context. Skipped when the caller EXPLICITLY asked
  // for one of those types (e.g. the dev-profile builder).
  entries = entries.filter(
    (e) => isModelMemory(e) || (types?.includes(e.type as MemoryType) ?? false)
  )

  // Reinforcement: nudge proven-useful entries up (bounded — relevance
  // still leads). This is how recall gets smarter with use.
  if (entries.length > 1) {
    entries = usefulnessService.rerank(projectId, entries)
  }

  // One hop of relationship-graph traversal so a recall carries its own
  // context instead of dangling `mem_N` pointers the agent must chase.
  if (opts.expandLinks !== false && entries.length > 0) {
    const linked = projectMemory.expandWithLinks(projectId, entries, 5)
    if (linked.length > 0) entries = entries.concat(linked)
  }

  // Ship-success attribution: these entries were surfaced during the
  // active task; if it ships, each earns the strong ship-credit.
  try {
    const task = await stateStorage.getCurrentTask(projectId)
    if (task?.id) {
      usefulnessService.recordSurfaced(
        projectId,
        entries.map((e) => e.id),
        task.id,
        new Date().toISOString(),
        { queryText: topic, surface: 'context-memory' }
      )
    }
  } catch {
    /* best-effort — attribution telemetry must never break a recall */
  }

  return entries
}
