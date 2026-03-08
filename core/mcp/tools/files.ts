/**
 * MCP File Tools (3 tools)
 *
 * Wraps existing context tools: files-tool, signatures-tool, state-storage.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { stateStorage } from '../../storage/state-storage'
import { findRelevantFiles } from '../../tools/context/files-tool'
import { extractSignatures } from '../../tools/context/signatures-tool'
import { resolveProjectId } from '../resolve'

// MCP SDK TS2589 workaround: cast server to avoid deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any

export function registerFileTools(server: McpServer) {
  const s: S = server

  s.tool(
    'prjct_relevant_files',
    'BM25-ranked files relevant to a query',
    {
      projectPath: z.string().describe('Project directory path'),
      query: z.string().describe('Task or query to find relevant files for'),
      maxFiles: z.number().optional().default(10).describe('Max files to return'),
    },
    async (args: { projectPath: string; query: string; maxFiles: number }) => {
      const result = await findRelevantFiles(args.query, args.projectPath, {
        maxFiles: args.maxFiles,
        minScore: 0.1,
      })

      if (result.files.length === 0) {
        return { content: [{ type: 'text', text: 'No relevant files found.' }] }
      }

      const lines = result.files.map(
        (f) => `- \`${f.path}\` (score: ${Math.round(f.score * 100)}%) — ${f.reasons.join(', ')}`
      )
      const text = `## Relevant Files (${result.files.length}/${result.metrics.filesScanned} scanned)\n\n${lines.join('\n')}`
      return { content: [{ type: 'text', text }] }
    }
  )

  s.tool(
    'prjct_signatures',
    'Code signatures from a file (90% token reduction vs full content)',
    {
      projectPath: z.string().describe('Project directory path'),
      filePath: z.string().describe('Relative file path to extract signatures from'),
    },
    async (args: { projectPath: string; filePath: string }) => {
      const result = await extractSignatures(args.filePath, args.projectPath)

      if (result.signatures.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: result.fallback
                ? `No signatures extracted: ${result.fallbackReason}`
                : 'No signatures found.',
            },
          ],
        }
      }

      const lines = result.signatures.map(
        (s) =>
          `${s.exported ? 'export ' : ''}${s.type} ${s.name}: ${s.signature}${s.docstring ? ` // ${s.docstring}` : ''}`
      )
      const compression = result.metrics?.compression
        ? ` (${Math.round(result.metrics.compression * 100)}% reduction)`
        : ''
      const text = `## ${result.file} (${result.language})\n\`\`\`\n${lines.join('\n')}\n\`\`\`${compression}`
      return { content: [{ type: 'text', text }] }
    }
  )

  s.tool(
    'prjct_history',
    'Recent completed tasks with outcomes',
    {
      projectPath: z.string().describe('Project directory path'),
      limit: z.number().optional().default(10).describe('Max results'),
    },
    async (args: { projectPath: string; limit: number }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const history = await stateStorage.getTaskHistory(projectId)

      if (history.length === 0) {
        return { content: [{ type: 'text', text: 'No task history.' }] }
      }

      const recent = history.slice(-args.limit).reverse()
      const lines = recent.map((t) => {
        const parts = [`- **${t.title}**`]
        if (t.completedAt) parts.push(`completed: ${t.completedAt}`)
        if (t.classification) parts.push(`type: ${t.classification}`)
        return parts.join(' | ')
      })

      const text = `## Task History (${history.length} total)\n\n${lines.join('\n')}`
      return { content: [{ type: 'text', text }] }
    }
  )
}
