/**
 * MCP Memory Tools (v2).
 *
 * Thin wrapper over `projectMemory` — the single source of truth for
 * project memory in v2. The pre-v2 surface (14 tools backed by
 * SemanticMemories + PatternStore + MemorySystem) was collapsed in
 * Phase C: those layers duplicated what `projectMemory` already does
 * and made the API confusing for Claude (which to call?).
 *
 * Tools exposed (4 total):
 *   - prjct_mem_save   — persist a memory entry
 *   - prjct_mem_list   — recall with optional topic / types / tags
 *   - prjct_mem_similar — fuzzy match against a description
 *   - prjct_mem_forget — remove an entry by id
 *
 * `prjct capture` / `prjct remember` from the CLI call the same
 * `projectMemory` API, so whatever the human types in the terminal
 * is visible here too, and vice versa.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { BASE_MEMORY_TYPES, formatMemoryMd, projectMemory } from '../../memory/project-memory'
import { scanForSecrets } from '../../memory/secret-scanner'
import { resolveProjectId } from '../resolve'
import { safeMcpCall } from './error-handler'

// MCP SDK TS2589 workaround: cast server to any to avoid deep type
// instantiation during tool registration.
// biome-ignore lint/suspicious/noExplicitAny: SDK generic instantiation is too deep for tsc
type S = any

const TYPE_DESCRIPTIONS = `Base types: ${BASE_MEMORY_TYPES.join(', ')}. Any lowercase identifier is accepted (e.g. "recipe", "okr").`

export function registerMemoryTools(server: McpServer) {
  const s: S = server

  s.tool(
    'prjct_mem_save',
    `Save a memory entry. ${TYPE_DESCRIPTIONS} Secret-like content is refused unless force=true.`,
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
        const entries = projectMemory.recall(projectId, {
          topic: args.topic,
          types: args.types,
          tags: args.tags,
          limit: args.limit,
        })
        return { content: [{ type: 'text', text: formatMemoryMd(entries) }] }
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
        const entries = projectMemory.similar(projectId, args.description, args.limit)
        if (entries.length === 0) {
          return { content: [{ type: 'text', text: 'No similar memories found.' }] }
        }
        return { content: [{ type: 'text', text: formatMemoryMd(entries) }] }
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
      // `projectMemory` doesn't expose a direct forget yet — the
      // event-sourced store treats deletion as a new entry. When
      // the API gains `projectMemory.forget(id)`, wire it here.
      // For now this is a declarative no-op with a hint.
      void args
      return {
        content: [
          {
            type: 'text',
            text: 'Forget is not implemented in the projectMemory API yet. Entries persist event-sourced — filter them out client-side, or drop the underlying event manually.',
          },
        ],
      }
    })
  )
}
