/**
 * MCP Memory Tools (14 tools)
 *
 * Wraps SemanticMemories (FTS5-backed).
 * Progressive disclosure: search returns compact results, use mem_get for full content.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import memorySystem from '../../agentic/memory-system'
import { PatternStore } from '../../agentic/pattern-store'
import { SemanticMemories } from '../../agentic/semantic-memories'
import prjctDb from '../../storage/database'
import { stateStorage } from '../../storage/state-storage'
import { resolveProjectId } from '../resolve'
import { safeMcpCall } from './error-handler'

const memories = new SemanticMemories()
const patternStore = new PatternStore()

/** Max content length before truncation on save */
const MAX_CONTENT_LENGTH = 3000
const TRUNCATION_MARKER = '\n... [truncated]'

/** Strip <private>...</private> tags from content */
function stripPrivateTags(text: string): string {
  return text.replace(/<private>[\s\S]*?<\/private>/gi, '').trim()
}

/** Truncate content to max length */
function truncateContent(text: string): string {
  if (text.length <= MAX_CONTENT_LENGTH) return text
  return text.slice(0, MAX_CONTENT_LENGTH - TRUNCATION_MARKER.length) + TRUNCATION_MARKER
}

// MCP SDK TS2589 workaround: cast server to avoid deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any

interface MemoryRow {
  id: string
  title: string
  content: string
  tags: string | null
  topic_key: string | null
  session_id: string | null
  created_at: string
  updated_at: string
}

/** Topic key family heuristics */
const TOPIC_FAMILIES: Array<{ prefix: string; keywords: string[]; description: string }> = [
  {
    prefix: 'architecture',
    keywords: ['design', 'structure', 'system', 'module', 'layer', 'pattern', 'dependency', 'api'],
    description: 'System design decisions',
  },
  {
    prefix: 'pattern',
    keywords: ['pattern', 'convention', 'style', 'approach', 'technique', 'idiom'],
    description: 'Code patterns discovered',
  },
  {
    prefix: 'bug',
    keywords: ['bug', 'fix', 'error', 'issue', 'crash', 'broken', 'regression', 'debug'],
    description: 'Bugs found and fixed',
  },
  {
    prefix: 'decision',
    keywords: ['decided', 'chose', 'selected', 'prefer', 'switched', 'migrated', 'replaced'],
    description: 'Technical decisions made',
  },
  {
    prefix: 'config',
    keywords: ['config', 'setting', 'env', 'variable', 'flag', 'option', 'parameter'],
    description: 'Configuration preferences',
  },
  {
    prefix: 'workflow',
    keywords: ['workflow', 'process', 'pipeline', 'deploy', 'ci', 'cd', 'release', 'ship'],
    description: 'Process preferences',
  },
  {
    prefix: 'convention',
    keywords: ['naming', 'format', 'lint', 'style', 'indent', 'import', 'export', 'case'],
    description: 'Naming, formatting, style',
  },
  {
    prefix: 'preference',
    keywords: ['prefer', 'like', 'always', 'never', 'use', 'avoid', 'want'],
    description: 'User preferences',
  },
]

export function registerMemoryTools(server: McpServer) {
  const s: S = server

  s.tool(
    'prjct_mem_save',
    'Save a memory with title, content, tags, and optional topic_key for upsert. Strips <private> tags and truncates at 3K chars.',
    {
      projectPath: z.string().describe('Project directory path'),
      title: z.string().describe('Memory title'),
      content: z.string().describe('Memory content'),
      tags: z.array(z.string()).optional().describe('Tags for categorization'),
      topicKey: z
        .string()
        .optional()
        .describe('Topic key for upsert (e.g. decision/auth-strategy, bug/cors-issue)'),
      sessionId: z.string().optional().describe('Current session ID to link this memory to'),
    },
    safeMcpCall(
      'prjct_mem_save',
      async (args: {
        projectPath: string
        title: string
        content: string
        tags?: string[]
        topicKey?: string
        sessionId?: string
      }) => {
        const projectId = await resolveProjectId(args.projectPath)
        const cleanContent = truncateContent(stripPrivateTags(args.content))
        const id = await memories.createMemory(projectId, {
          title: args.title,
          content: cleanContent,
          tags: args.tags,
          topicKey: args.topicKey,
          userTriggered: true,
        })

        if (args.sessionId) {
          prjctDb.run(
            projectId,
            'UPDATE memories SET session_id = ? WHERE id = ?',
            args.sessionId,
            id
          )
        }

        return { content: [{ type: 'text', text: `Memory saved: ${id}` }] }
      }
    )
  )

  s.tool(
    'prjct_mem_search',
    'FTS5 search — returns compact results (title + snippet + ID). Use prjct_mem_get for full content.',
    {
      projectPath: z.string().describe('Project directory path'),
      query: z.string().describe('Search query'),
      limit: z.number().optional().default(20).describe('Max results (default 20)'),
      offset: z.number().optional().default(0).describe('Offset for pagination (default 0)'),
    },
    safeMcpCall(
      'prjct_mem_search',
      async (args: { projectPath: string; query: string; limit: number; offset: number }) => {
        const projectId = await resolveProjectId(args.projectPath)
        const results = await memories.searchMemories(
          projectId,
          args.query,
          args.limit,
          args.offset
        )

        // Also search pattern store (decisions + preferences) for unified results
        const queryLower = args.query.toLowerCase()
        const patternLines: string[] = []
        try {
          const detailed = await patternStore.getPatternsSummaryDetailed(projectId)
          for (const [key, d] of Object.entries(detailed.decisions)) {
            if (
              key.toLowerCase().includes(queryLower) ||
              d.value.toLowerCase().includes(queryLower)
            ) {
              patternLines.push(
                `- **[decision] ${key}**: ${d.value} (confidence: ${d.confidence}, seen: ${d.count}x)`
              )
            }
          }
          for (const [key, p] of Object.entries(detailed.preferences)) {
            const valStr = typeof p.value === 'string' ? p.value : JSON.stringify(p.value)
            if (
              key.toLowerCase().includes(queryLower) ||
              valStr.toLowerCase().includes(queryLower)
            ) {
              patternLines.push(
                `- **[preference] ${key}**: ${valStr} (confidence: ${p.confidence})`
              )
            }
          }
        } catch {
          // Pattern store may not have data yet
        }

        if (results.length === 0 && patternLines.length === 0) {
          return { content: [{ type: 'text', text: 'No memories found.' }] }
        }

        const parts: string[] = []

        if (results.length > 0) {
          const lines = results.map((m) => {
            const snippet = m.content.slice(0, 120).replace(/\n/g, ' ')
            const tags = m.tags.length > 0 ? ` [${m.tags.join(', ')}]` : ''
            return `- **${m.title}** (id: ${m.id})${tags}\n  ${snippet}${m.content.length > 120 ? '...' : ''}`
          })
          parts.push(`Found ${results.length} memories:\n\n${lines.join('\n')}`)
        }

        if (patternLines.length > 0) {
          parts.push(`\n### Matching Patterns (${patternLines.length})\n${patternLines.join('\n')}`)
        }

        return { content: [{ type: 'text', text: parts.join('\n') }] }
      }
    )
  )

  s.tool(
    'prjct_mem_get',
    'Get full untruncated memory content by ID (progressive disclosure step 2)',
    {
      projectPath: z.string().describe('Project directory path'),
      memoryId: z.string().describe('Memory ID'),
    },
    safeMcpCall('prjct_mem_get', async (args: { projectPath: string; memoryId: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const memory = await memories.getMemoryById(projectId, args.memoryId)
      if (!memory) {
        return { content: [{ type: 'text', text: `Memory ${args.memoryId} not found.` }] }
      }
      return {
        content: [
          {
            type: 'text',
            text: `# ${memory.title}\n\n${memory.content}\n\nTags: ${memory.tags.join(', ') || 'none'}\nCreated: ${memory.createdAt}\nUpdated: ${memory.updatedAt}`,
          },
        ],
      }
    })
  )

  s.tool(
    'prjct_mem_delete',
    'Soft-delete a memory by ID',
    {
      projectPath: z.string().describe('Project directory path'),
      memoryId: z.string().describe('Memory ID to delete'),
    },
    safeMcpCall('prjct_mem_delete', async (args: { projectPath: string; memoryId: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const deleted = await memories.deleteMemory(projectId, args.memoryId)
      return {
        content: [{ type: 'text', text: deleted ? 'Memory deleted.' : 'Memory not found.' }],
      }
    })
  )

  s.tool(
    'prjct_mem_context',
    'Get memories relevant to a task description',
    {
      projectPath: z.string().describe('Project directory path'),
      task: z.string().describe('Task description for relevance matching'),
      limit: z.number().optional().default(5).describe('Max results'),
    },
    safeMcpCall(
      'prjct_mem_context',
      async (args: { projectPath: string; task: string; limit: number }) => {
        const projectId = await resolveProjectId(args.projectPath)
        const results = await memories.getRelevantMemories(
          projectId,
          { params: { description: args.task } },
          args.limit
        )
        if (results.length === 0) {
          return { content: [{ type: 'text', text: 'No relevant memories.' }] }
        }
        const text = results.map((m) => `- **${m.title}**: ${m.content.slice(0, 200)}`).join('\n')
        return { content: [{ type: 'text', text }] }
      }
    )
  )

  s.tool(
    'prjct_mem_timeline',
    'Chronological memories around a specific memory (progressive disclosure step 2). Shows ±5 items in the same session.',
    {
      projectPath: z.string().describe('Project directory path'),
      memoryId: z.string().describe('Memory ID to center timeline on'),
    },
    safeMcpCall('prjct_mem_timeline', async (args: { projectPath: string; memoryId: string }) => {
      const projectId = await resolveProjectId(args.projectPath)

      const target = prjctDb.get<MemoryRow>(
        projectId,
        'SELECT * FROM memories WHERE id = ? AND project_id = ? AND deleted_at IS NULL',
        args.memoryId,
        projectId
      )
      if (!target) {
        return { content: [{ type: 'text', text: `Memory ${args.memoryId} not found.` }] }
      }

      let neighbors: MemoryRow[]
      if (target.session_id) {
        neighbors = prjctDb.query<MemoryRow>(
          projectId,
          `SELECT * FROM memories
             WHERE project_id = ? AND session_id = ? AND deleted_at IS NULL
             ORDER BY created_at ASC`,
          projectId,
          target.session_id
        )
      } else {
        const before = prjctDb
          .query<MemoryRow>(
            projectId,
            `SELECT * FROM memories
             WHERE project_id = ? AND deleted_at IS NULL AND created_at < ?
             ORDER BY created_at DESC LIMIT 5`,
            projectId,
            target.created_at
          )
          .reverse()

        const after = prjctDb.query<MemoryRow>(
          projectId,
          `SELECT * FROM memories
             WHERE project_id = ? AND deleted_at IS NULL AND created_at > ?
             ORDER BY created_at ASC LIMIT 5`,
          projectId,
          target.created_at
        )

        neighbors = [...before, target, ...after]
      }

      if (neighbors.length === 0) {
        return { content: [{ type: 'text', text: 'No timeline context.' }] }
      }

      const lines = neighbors.map((m) => {
        const marker = m.id === args.memoryId ? '→' : ' '
        const snippet = m.content.slice(0, 100).replace(/\n/g, ' ')
        return `${marker} [${m.created_at}] **${m.title}** (${m.id})\n  ${snippet}${m.content.length > 100 ? '...' : ''}`
      })

      const sessionInfo = target.session_id ? `\nSession: ${target.session_id}` : ''
      return {
        content: [
          {
            type: 'text',
            text: `## Timeline around "${target.title}"${sessionInfo}\n\n${lines.join('\n')}`,
          },
        ],
      }
    })
  )

  s.tool(
    'prjct_mem_suggest_topic',
    'Suggest a stable topic_key based on title and content. Uses family heuristics: architecture/*, pattern/*, bug/*, decision/*, config/*, workflow/*, convention/*, preference/*',
    {
      projectPath: z.string().describe('Project directory path'),
      title: z.string().describe('Memory title'),
      content: z.string().describe('Memory content'),
    },
    safeMcpCall(
      'prjct_mem_suggest_topic',
      async (args: { projectPath: string; title: string; content: string }) => {
        const combined = `${args.title} ${args.content}`.toLowerCase()

        let bestFamily = TOPIC_FAMILIES[0]
        let bestScore = 0
        for (const family of TOPIC_FAMILIES) {
          const score = family.keywords.filter((kw) => combined.includes(kw)).length
          if (score > bestScore) {
            bestScore = score
            bestFamily = family
          }
        }

        const slug = args.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40)

        const suggested = `${bestFamily.prefix}/${slug}`

        const projectId = await resolveProjectId(args.projectPath)
        const existing = prjctDb.get<{ id: string; title: string }>(
          projectId,
          'SELECT id, title FROM memories WHERE project_id = ? AND topic_key = ? AND deleted_at IS NULL',
          projectId,
          suggested
        )

        const lines = [
          `Suggested topic_key: \`${suggested}\``,
          `Family: ${bestFamily.prefix} — ${bestFamily.description}`,
          `Confidence: ${bestScore === 0 ? 'low (no keyword matches, defaulted)' : bestScore >= 3 ? 'high' : 'medium'}`,
        ]

        if (existing) {
          lines.push(
            `\nNote: This topic_key already exists → will UPDATE "${existing.title}" (id: ${existing.id})`
          )
        }

        lines.push('\nAvailable families:')
        for (const f of TOPIC_FAMILIES) {
          lines.push(`- \`${f.prefix}/*\` — ${f.description}`)
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] }
      }
    )
  )

  s.tool(
    'prjct_mem_capture_passive',
    'Extract structured learnings from text and save each as a memory. Looks for "Key Learnings:", "Discoveries:", "Lessons:", or "## Learnings" sections.',
    {
      projectPath: z.string().describe('Project directory path'),
      text: z.string().describe('Text to extract learnings from (e.g. agent output)'),
      sessionId: z.string().optional().describe('Current session ID'),
    },
    safeMcpCall(
      'prjct_mem_capture_passive',
      async (args: { projectPath: string; text: string; sessionId?: string }) => {
        const projectId = await resolveProjectId(args.projectPath)

        const patterns = [
          /(?:^|\n)#{1,3}\s*(?:Key\s+)?Learnings?\s*:?\s*\n([\s\S]*?)(?=\n#{1,3}\s|\n---|\n\*\*[A-Z]|$)/i,
          /(?:^|\n)#{1,3}\s*Discoveries?\s*:?\s*\n([\s\S]*?)(?=\n#{1,3}\s|\n---|\n\*\*[A-Z]|$)/i,
          /(?:^|\n)#{1,3}\s*Lessons?\s*:?\s*\n([\s\S]*?)(?=\n#{1,3}\s|\n---|\n\*\*[A-Z]|$)/i,
          /(?:^|\n)\*\*(?:Key\s+)?Learnings?\*\*\s*:?\s*\n([\s\S]*?)(?=\n\*\*[A-Z]|\n#{1,3}\s|\n---|$)/i,
        ]

        const extracted: string[] = []
        for (const pattern of patterns) {
          const match = args.text.match(pattern)
          if (match?.[1]) {
            const items = match[1]
              .split(/\n[-*•]\s+|\n\d+[.)]\s+/)
              .map((s) => s.trim())
              .filter((s) => s.length > 10)
            extracted.push(...items)
          }
        }

        if (extracted.length === 0) {
          return { content: [{ type: 'text', text: 'No structured learnings found in text.' }] }
        }

        const unique = [...new Set(extracted)]
        const savedIds: string[] = []

        for (const learning of unique.slice(0, 10)) {
          const title = learning.slice(0, 80).replace(/\n/g, ' ')
          const cleanContent = truncateContent(stripPrivateTags(learning))
          const id = await memories.createMemory(projectId, {
            title,
            content: cleanContent,
            tags: [],
            topicKey: `learning/${title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .slice(0, 40)}`,
            userTriggered: false,
          })

          if (args.sessionId) {
            prjctDb.run(
              projectId,
              'UPDATE memories SET session_id = ? WHERE id = ?',
              args.sessionId,
              id
            )
          }
          savedIds.push(id)
        }

        return {
          content: [
            {
              type: 'text',
              text: `Extracted and saved ${savedIds.length} learnings:\n${savedIds.map((id, i) => `- ${unique[i].slice(0, 60)}... (${id})`).join('\n')}`,
            },
          ],
        }
      }
    )
  )

  // =========================================================================
  // Sprint 11: New tools — update, stats, tags
  // =========================================================================

  s.tool(
    'prjct_mem_update',
    'Update an existing memory by ID. Partial updates supported (title, content, tags).',
    {
      projectPath: z.string().describe('Project directory path'),
      memoryId: z.string().describe('Memory ID to update'),
      title: z.string().optional().describe('New title'),
      content: z.string().optional().describe('New content'),
      tags: z.array(z.string()).optional().describe('New tags'),
    },
    safeMcpCall(
      'prjct_mem_update',
      async (args: {
        projectPath: string
        memoryId: string
        title?: string
        content?: string
        tags?: string[]
      }) => {
        const projectId = await resolveProjectId(args.projectPath)
        const updates: { title?: string; content?: string; tags?: string[] } = {}
        if (args.title) updates.title = args.title
        if (args.content) updates.content = truncateContent(stripPrivateTags(args.content))
        if (args.tags) updates.tags = args.tags

        const updated = await memories.updateMemory(projectId, args.memoryId, updates)
        return {
          content: [
            {
              type: 'text',
              text: updated ? `Memory ${args.memoryId} updated.` : 'Memory not found.',
            },
          ],
        }
      }
    )
  )

  s.tool(
    'prjct_mem_stats',
    'Memory statistics: total count, user-triggered count, tag distribution, age range',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_mem_stats', async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const stats = await memories.getMemoryStats(projectId)

      const parts = [
        '## Memory Stats',
        `Total: ${stats.totalMemories}`,
        `User-triggered: ${stats.userTriggered}`,
        `Auto-captured: ${stats.totalMemories - stats.userTriggered}`,
      ]

      if (stats.oldestMemory) parts.push(`Oldest: ${stats.oldestMemory}`)
      if (stats.newestMemory) parts.push(`Newest: ${stats.newestMemory}`)

      const tagEntries = Object.entries(stats.tagCounts)
      if (tagEntries.length > 0) {
        parts.push('\n### Tags')
        for (const [tag, count] of tagEntries.sort(([, a], [, b]) => b - a)) {
          parts.push(`- ${tag}: ${count}`)
        }
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    })
  )

  s.tool(
    'prjct_mem_tags',
    'Find memories by tags (matchAll: require all tags, default: match any)',
    {
      projectPath: z.string().describe('Project directory path'),
      tags: z.array(z.string()).describe('Tags to search for'),
      matchAll: z
        .boolean()
        .optional()
        .default(false)
        .describe('Require all tags to match (default: any)'),
    },
    safeMcpCall(
      'prjct_mem_tags',
      async (args: { projectPath: string; tags: string[]; matchAll: boolean }) => {
        const projectId = await resolveProjectId(args.projectPath)
        const results = await memories.findByTags(projectId, args.tags, args.matchAll)

        if (results.length === 0) {
          return { content: [{ type: 'text', text: 'No memories found with those tags.' }] }
        }

        const lines = results.map((m) => {
          const snippet = m.content.slice(0, 120).replace(/\n/g, ' ')
          const tags = m.tags.length > 0 ? ` [${m.tags.join(', ')}]` : ''
          return `- **${m.title}** (id: ${m.id})${tags}\n  ${snippet}${m.content.length > 120 ? '...' : ''}`
        })

        return {
          content: [
            { type: 'text', text: `Found ${results.length} memories:\n\n${lines.join('\n')}` },
          ],
        }
      }
    )
  )

  // =========================================================================
  // Sprint 15: mem_topic + feedback_aggregate
  // =========================================================================

  s.tool(
    'prjct_mem_topic',
    'Browse memories by topic_key prefix (e.g. "bug/*", "decision/*")',
    {
      projectPath: z.string().describe('Project directory path'),
      prefix: z.string().describe('Topic key prefix to match (e.g. "bug/", "decision/")'),
      limit: z.number().optional().default(20).describe('Max results (default 20)'),
    },
    safeMcpCall(
      'prjct_mem_topic',
      async (args: { projectPath: string; prefix: string; limit: number }) => {
        const projectId = await resolveProjectId(args.projectPath)

        // Normalize prefix: ensure it ends with % for LIKE query
        const likePattern = args.prefix.endsWith('*')
          ? `${args.prefix.slice(0, -1)}%`
          : args.prefix.endsWith('%')
            ? args.prefix
            : `${args.prefix}%`

        const rows = prjctDb.query<MemoryRow>(
          projectId,
          `SELECT * FROM memories
           WHERE project_id = ? AND topic_key LIKE ? AND deleted_at IS NULL
           ORDER BY updated_at DESC LIMIT ?`,
          projectId,
          likePattern,
          args.limit
        )

        if (rows.length === 0) {
          return {
            content: [
              { type: 'text', text: `No memories found with topic prefix "${args.prefix}".` },
            ],
          }
        }

        const lines = rows.map((m) => {
          const snippet = m.content.slice(0, 120).replace(/\n/g, ' ')
          return `- **${m.title}** (topic: ${m.topic_key}, id: ${m.id})\n  ${snippet}${m.content.length > 120 ? '...' : ''}`
        })

        return {
          content: [
            {
              type: 'text',
              text: `## Memories: ${args.prefix} (${rows.length})\n\n${lines.join('\n')}`,
            },
          ],
        }
      }
    )
  )

  s.tool(
    'prjct_mem_consolidate',
    'Find and merge duplicate/similar memories (same title). Returns count merged.',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_mem_consolidate', async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const result = await memorySystem.consolidateMemories(projectId)

      if (result.merged === 0) {
        return { content: [{ type: 'text', text: 'No duplicate memories found.' }] }
      }

      const parts = [`## Consolidation Complete`, `Merged: ${result.merged} duplicate memories\n`]

      for (const group of result.groups) {
        parts.push(`- Kept ${group.kept}, merged ${group.merged.length} duplicates`)
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    })
  )

  s.tool(
    'prjct_feedback_aggregate',
    'Aggregated task feedback: confirmed stack, gotchas, agent accuracy',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_feedback_aggregate', async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const feedback = await stateStorage.getAggregatedFeedback(projectId)

      const parts = ['## Aggregated Task Feedback']

      if (feedback.stackConfirmed.length > 0) {
        parts.push(`\n### Confirmed Stack`)
        parts.push(feedback.stackConfirmed.join(', '))
      }

      if (feedback.patternsDiscovered.length > 0) {
        parts.push(`\n### Patterns Discovered`)
        for (const p of feedback.patternsDiscovered) {
          parts.push(`- ${p}`)
        }
      }

      if (feedback.knownGotchas.length > 0) {
        parts.push(`\n### Known Gotchas`)
        for (const g of feedback.knownGotchas) {
          parts.push(`- ${g}`)
        }
      }

      if (feedback.agentAccuracy.length > 0) {
        parts.push(`\n### Agent Accuracy`)
        for (const a of feedback.agentAccuracy) {
          parts.push(`- ${a.agent}: ${a.rating}${a.note ? ` — ${a.note}` : ''}`)
        }
      }

      if (feedback.issuesEncountered.length > 0) {
        parts.push(`\n### Issues Encountered`)
        for (const i of feedback.issuesEncountered) {
          parts.push(`- ${i}`)
        }
      }

      const isEmpty =
        feedback.stackConfirmed.length === 0 &&
        feedback.patternsDiscovered.length === 0 &&
        feedback.knownGotchas.length === 0

      if (isEmpty) {
        parts.push('\nNo task feedback recorded yet.')
      }

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    })
  )
}
