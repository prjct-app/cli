/**
 * MCP Memory Tools (5 tools)
 *
 * Wraps SemanticMemories (FTS5-backed).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { SemanticMemories } from '../../agentic/semantic-memories'
import { resolveProjectId } from '../resolve'

const memories = new SemanticMemories()

// MCP SDK TS2589 workaround: cast server to avoid deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any

export function registerMemoryTools(server: McpServer) {
  const s: S = server

  s.tool(
    'prjct_mem_save',
    'Save a memory with title, content, tags, and optional topic_key for upsert',
    {
      projectPath: z.string().describe('Project directory path'),
      title: z.string().describe('Memory title'),
      content: z.string().describe('Memory content'),
      tags: z.array(z.string()).optional().describe('Tags for categorization'),
      topicKey: z.string().optional().describe('Topic key for upsert (same key = update)'),
    },
    async (args: {
      projectPath: string
      title: string
      content: string
      tags?: string[]
      topicKey?: string
    }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const id = await memories.createMemory(projectId, {
        title: args.title,
        content: args.content,
        tags: args.tags,
        topicKey: args.topicKey,
        userTriggered: true,
      })
      return { content: [{ type: 'text', text: `Memory saved: ${id}` }] }
    }
  )

  s.tool(
    'prjct_mem_search',
    'FTS5 full-text search with BM25 ranking + snippets',
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
      const text = results
        .map((m) => `## ${m.title}\n${m.content}\n_Tags: ${m.tags.join(', ') || 'none'}_`)
        .join('\n\n---\n\n')
      return { content: [{ type: 'text', text }] }
    }
  )

  s.tool(
    'prjct_mem_get',
    'Get full memory content by ID',
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
}
