/**
 * MCP Memory Tools (8 tools)
 *
 * Wraps SemanticMemories (FTS5-backed).
 * Progressive disclosure: search returns compact results, use mem_get for full content.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { SemanticMemories } from '../../agentic/semantic-memories'
import prjctDb from '../../storage/database'
import { resolveProjectId } from '../resolve'

const memories = new SemanticMemories()

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

      // Link to session if provided
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

  s.tool(
    'prjct_mem_search',
    'FTS5 search — returns compact results (title + snippet + ID). Use prjct_mem_get for full content.',
    {
      projectPath: z.string().describe('Project directory path'),
      query: z.string().describe('Search query'),
    },
    async (args: { projectPath: string; query: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const results = await memories.searchMemories(projectId, args.query)
      if (results.length === 0) {
        return { content: [{ type: 'text', text: 'No memories found.' }] }
      }
      // Compact format: ID + title + snippet (progressive disclosure)
      const lines = results.map((m) => {
        const snippet = m.content.slice(0, 120).replace(/\n/g, ' ')
        const tags = m.tags.length > 0 ? ` [${m.tags.join(', ')}]` : ''
        return `- **${m.title}** (id: ${m.id})${tags}\n  ${snippet}${m.content.length > 120 ? '...' : ''}`
      })
      const text = `Found ${results.length} memories:\n\n${lines.join('\n')}`
      return { content: [{ type: 'text', text }] }
    }
  )

  s.tool(
    'prjct_mem_get',
    'Get full untruncated memory content by ID (progressive disclosure step 2)',
    {
      projectPath: z.string().describe('Project directory path'),
      memoryId: z.string().describe('Memory ID'),
    },
    async (args: { projectPath: string; memoryId: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const all = await memories.getAllMemories(projectId)
      const memory = all.find((m) => m.id === args.memoryId)
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
    }
  )

  s.tool(
    'prjct_mem_delete',
    'Soft-delete a memory by ID',
    {
      projectPath: z.string().describe('Project directory path'),
      memoryId: z.string().describe('Memory ID to delete'),
    },
    async (args: { projectPath: string; memoryId: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const deleted = await memories.deleteMemory(projectId, args.memoryId)
      return {
        content: [{ type: 'text', text: deleted ? 'Memory deleted.' : 'Memory not found.' }],
      }
    }
  )

  s.tool(
    'prjct_mem_context',
    'Get memories relevant to a task description',
    {
      projectPath: z.string().describe('Project directory path'),
      task: z.string().describe('Task description for relevance matching'),
      limit: z.number().optional().default(5).describe('Max results'),
    },
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

  s.tool(
    'prjct_mem_timeline',
    'Chronological memories around a specific memory (progressive disclosure step 2). Shows ±5 items in the same session.',
    {
      projectPath: z.string().describe('Project directory path'),
      memoryId: z.string().describe('Memory ID to center timeline on'),
    },
    async (args: { projectPath: string; memoryId: string }) => {
      const projectId = await resolveProjectId(args.projectPath)

      // Get the target memory
      const target = prjctDb.get<MemoryRow>(
        projectId,
        'SELECT * FROM memories WHERE id = ? AND project_id = ? AND deleted_at IS NULL',
        args.memoryId,
        projectId
      )
      if (!target) {
        return { content: [{ type: 'text', text: `Memory ${args.memoryId} not found.` }] }
      }

      // Get neighbors: same session if available, otherwise chronological
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
        // Get ±5 chronologically
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
    }
  )

  s.tool(
    'prjct_mem_suggest_topic',
    'Suggest a stable topic_key based on title and content. Uses family heuristics: architecture/*, pattern/*, bug/*, decision/*, config/*, workflow/*, convention/*, preference/*',
    {
      projectPath: z.string().describe('Project directory path'),
      title: z.string().describe('Memory title'),
      content: z.string().describe('Memory content'),
    },
    async (args: { projectPath: string; title: string; content: string }) => {
      const combined = `${args.title} ${args.content}`.toLowerCase()

      // Score each family by keyword matches
      let bestFamily = TOPIC_FAMILIES[0]
      let bestScore = 0
      for (const family of TOPIC_FAMILIES) {
        const score = family.keywords.filter((kw) => combined.includes(kw)).length
        if (score > bestScore) {
          bestScore = score
          bestFamily = family
        }
      }

      // Generate slug from title
      const slug = args.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)

      const suggested = `${bestFamily.prefix}/${slug}`

      // Check if this topic_key already exists
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

  s.tool(
    'prjct_mem_capture_passive',
    'Extract structured learnings from text and save each as a memory. Looks for "Key Learnings:", "Discoveries:", "Lessons:", or "## Learnings" sections.',
    {
      projectPath: z.string().describe('Project directory path'),
      text: z.string().describe('Text to extract learnings from (e.g. agent output)'),
      sessionId: z.string().optional().describe('Current session ID'),
    },
    async (args: { projectPath: string; text: string; sessionId?: string }) => {
      const projectId = await resolveProjectId(args.projectPath)

      // Extract learnings from structured sections
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
          // Split by bullet points or numbered items
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

      // Deduplicate
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
}
