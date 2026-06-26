/**
 * MCP Memory Tools (v2).
 *
 * Thin wrapper over `projectMemory` — the single source of truth for
 * project memory in v2. The pre-v2 surface (14 tools backed by
 * SemanticMemories + PatternStore + MemorySystem) was collapsed in
 * Phase C: those layers duplicated what `projectMemory` already does
 * and made the API confusing for Claude (which to call?).
 *
 * Tools exposed (5 total):
 *   - prjct_mem_save   — persist a memory entry
 *   - prjct_mem_list   — recall with optional topic / types / tags
 *   - prjct_mem_similar — fuzzy match against a description
 *   - prjct_mem_forget — remove an entry by id
 *   - prjct_guard      — ANTICIPATION: preventive memory for a file, on demand
 *
 * `prjct_guard` is the pull-based form of pillar 3 (anticipation): an
 * agent asks "what should I know before editing this file?" and gets back
 * only the gotchas / anti-patterns / recurring-bugs recorded against it.
 * Provider-agnostic — Codex (no hooks) and Claude both reach it here,
 * instead of pushing the warning into every turn's context.
 *
 * `prjct capture` / `prjct remember` from the CLI call the same
 * `projectMemory` API, so whatever the human types in the terminal
 * is visible here too, and vice versa.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { enrichedRecall } from '../../memory/enriched-recall'
import { BASE_MEMORY_TYPES, type MemoryType } from '../../memory/entries'
import { formatMemoryMd } from '../../memory/format'
import { projectMemory } from '../../memory/project-memory'
import { recordSurfacedForActiveTask } from '../../services/usefulness/surface-attribution'
import { scanForPromptInjection } from '../../utils/prompt-injection'
import { scanForSecrets } from '../../utils/secret-scanner'
import { resolveProjectId } from '../resolve'
import { safeMcpCall } from './error-handler'

// MCP SDK TS2589 workaround: cast server to any to avoid deep type
// instantiation during tool registration.
type S = any

const TYPE_DESCRIPTIONS = `Base types: ${BASE_MEMORY_TYPES.join(', ')}. Any lowercase identifier is accepted (e.g. "recipe", "okr").`

export function registerMemoryTools(server: McpServer) {
  const s: S = server

  s.tool(
    'prjct_mem_save',
    `Save a memory entry. Author content in ENGLISH regardless of the conversation language. ${TYPE_DESCRIPTIONS} Secret-like content is refused unless force=true.`,
    {
      projectPath: z.string().describe('Project directory path'),
      type: z.string().describe('Memory type (fact/decision/learning/... or user-defined)'),
      content: z.string().describe('The memory content. Freeform text.'),
      tags: z
        .record(z.string(), z.string())
        .optional()
        .describe('Key:value tags (e.g. {domain: "auth"})'),
      source: z.string().optional().describe('Task id this memory came from, if any'),
      force: z
        .boolean()
        .optional()
        .describe('Bypass the secret-like-content refusal. Default false.'),
    },
    safeMcpCall(
      'prjct_mem_save',
      async (args: {
        projectPath: string
        type: string
        content: string
        tags?: Record<string, string>
        source?: string
        force?: boolean
      }) => {
        await resolveProjectId(args.projectPath)

        const typeStr = args.type.toLowerCase().trim()
        if (!typeStr || !/^[a-z][a-z0-9-]*$/.test(typeStr)) {
          return {
            content: [
              {
                type: 'text',
                text: `Invalid type '${args.type}'. Lowercase letters + dashes only. ${TYPE_DESCRIPTIONS}`,
              },
            ],
          }
        }

        const secretHits = scanForSecrets(args.content)
        if (secretHits.length > 0 && !args.force) {
          return {
            content: [
              {
                type: 'text',
                text: `Refused — content looks like a secret (${secretHits.join(', ')}). Re-call with force=true if intentional.`,
              },
            ],
          }
        }

        const injectionHits = scanForPromptInjection(args.content)
        if (injectionHits.length > 0 && !args.force) {
          return {
            content: [
              {
                type: 'text',
                text: `Refused — content looks like prompt injection (${injectionHits.join(', ')}). Memory entries are inlined into LLM context. Re-call with force=true if intentional.`,
              },
            ],
          }
        }

        await projectMemory.remember(args.projectPath, {
          type: typeStr,
          content: args.content,
          tags: args.tags ?? {},
          source: args.source,
        })
        return {
          content: [{ type: 'text', text: `Saved ${typeStr}: ${args.content.slice(0, 80)}` }],
        }
      }
    )
  )

  s.tool(
    'prjct_mem_list',
    'Recall memory entries. Optional filters: topic (keyword across content + tag values), types, tags, limit.',
    {
      projectPath: z.string().describe('Project directory path'),
      topic: z.string().optional().describe('Keyword to match over content + tag values'),
      types: z.array(z.string()).optional().describe('Restrict to these types'),
      tags: z
        .record(z.string(), z.string())
        .optional()
        .describe('Require exact match on these k:v pairs'),
      limit: z.number().optional().default(25).describe('Max entries (default 25)'),
    },
    safeMcpCall(
      'prjct_mem_list',
      async (args: {
        projectPath: string
        topic?: string
        types?: string[]
        tags?: Record<string, string>
        limit?: number
      }) => {
        const projectId = await resolveProjectId(args.projectPath)
        // Same pipeline as `prjct context memory` (FTS-first, semantic
        // blend, usefulness rerank, link expansion, ship attribution).
        // Subagents reach memory through THIS tool — a plain recency
        // recall here gave them strictly worse retrieval than the CLI.
        const entries = await enrichedRecall(args.projectPath, projectId, {
          topic: args.topic,
          types: args.types as MemoryType[] | undefined,
          tags: args.tags,
          limit: args.limit,
        })
        return { content: [{ type: 'text', text: formatMemoryMd(entries, { boundary: 'llm' }) }] }
      }
    )
  )

  s.tool(
    'prjct_mem_similar',
    'Find memory entries similar to a free-text description. Keyword-based, best-effort.',
    {
      projectPath: z.string().describe('Project directory path'),
      description: z.string().describe('Free-text description to find similar memories for'),
      limit: z.number().optional().default(10).describe('Max results (default 10)'),
    },
    safeMcpCall(
      'prjct_mem_similar',
      async (args: { projectPath: string; description: string; limit?: number }) => {
        const projectId = await resolveProjectId(args.projectPath)
        // enrichedRecall with the description as topic: BM25 + semantic
        // beat the old shared-keyword `similar()` heuristic. Link
        // expansion off — similarity asks "does this exist?", not "give
        // me its whole neighborhood".
        const entries = await enrichedRecall(args.projectPath, projectId, {
          topic: args.description,
          limit: args.limit ?? 10,
          expandLinks: false,
        })
        if (entries.length === 0) {
          return { content: [{ type: 'text', text: 'No similar memories found.' }] }
        }
        return { content: [{ type: 'text', text: formatMemoryMd(entries, { boundary: 'llm' }) }] }
      }
    )
  )

  s.tool(
    'prjct_guard',
    'Anticipation: before editing a file, get the preventive memory recorded against it — gotchas, anti-patterns, recurring bugs only. Empty result means clear to edit. Pull this instead of guessing what might break.',
    {
      projectPath: z.string().describe('Project directory path'),
      file: z.string().describe('File to check (absolute or repo-relative)'),
      limit: z.number().optional().default(3).describe('Max preventive entries (default 3)'),
    },
    safeMcpCall(
      'prjct_guard',
      async (args: { projectPath: string; file: string; limit?: number }) => {
        const projectId = await resolveProjectId(args.projectPath)
        const hits = projectMemory.recallForFile(projectId, args.file, args.limit ?? 3)
        // Push-path ship attribution (see surface-attribution.ts).
        void recordSurfacedForActiveTask(
          projectId,
          args.projectPath,
          hits.map((e) => e.id)
        )
        if (hits.length === 0) {
          const base = args.file.split('/').pop() ?? args.file
          return {
            content: [{ type: 'text', text: `No preventive memory for ${base} — clear to edit.` }],
          }
        }
        return { content: [{ type: 'text', text: formatMemoryMd(hits, { boundary: 'llm' }) }] }
      }
    )
  )

  s.tool(
    'prjct_mem_forget',
    'Remove a memory entry by id. Ids are stable — pull them from `prjct_mem_list`.',
    {
      projectPath: z.string().describe('Project directory path'),
      id: z.string().describe('Memory id (e.g. "mem_42" or "ship_7")'),
    },
    safeMcpCall('prjct_mem_forget', async (args: { projectPath: string; id: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const removed = projectMemory.forget(projectId, args.id)
      if (removed) {
        const { requestVaultRegeneration } = await import('../../services/vault-regeneration')
        await requestVaultRegeneration(args.projectPath, projectId)
      }
      return {
        content: [
          {
            type: 'text',
            text: removed
              ? `✓ forgot ${args.id} — removed from recall, search, and embeddings.`
              : `_No memory entry with id ${args.id} (already gone, or not a remember entry)._`,
          },
        ],
      }
    })
  )
}
