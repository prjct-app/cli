/**
 * MCP Obsidian Tools (8 tools)
 *
 * Direct vault access for AI agents: read, write, search, list notes
 * in the project's Obsidian KB. Includes export and stats.
 *
 * Security: path traversal prevention, extension whitelist, blocked dirs.
 */

import path from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import configManager from '../../infrastructure/config-manager'
import { obsidianExporter } from '../../services/obsidian-exporter'
import type { ObsidianConfig } from '../../types/integrations'
import { resolveProjectId } from '../resolve'
import { safeMcpCall } from './error-handler'

// MCP SDK TS2589 workaround
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any

/** Resolve ObsidianConfig from projectPath */
async function resolveObsidian(
  projectPath: string
): Promise<{ projectId: string; config: ObsidianConfig; projectName: string }> {
  const projectId = await resolveProjectId(projectPath)
  const globalConfig = await configManager.readGlobalConfig(projectId)
  const config = globalConfig?.integrations?.obsidian
  if (!config) {
    throw new Error(
      'Obsidian not configured. Run: prjct obsidian setup --vault-path /path/to/vault'
    )
  }
  const projectName = config.projectFolder || path.basename(projectPath)
  return { projectId, config, projectName }
}

export function registerObsidianTools(server: McpServer) {
  const s: S = server

  // =========================================================================
  // 1. Read a note
  // =========================================================================
  s.tool(
    'prjct_obsidian_read',
    'Read a note from the project Obsidian vault. Returns content and frontmatter.',
    {
      projectPath: z.string().describe('Project directory path'),
      notePath: z
        .string()
        .describe('Relative path within the project vault folder (e.g., "architecture/auth.md")'),
    },
    safeMcpCall('prjct_obsidian_read', async (args: { projectPath: string; notePath: string }) => {
      const { config, projectName } = await resolveObsidian(args.projectPath)
      const result = await obsidianExporter.readNote(config, projectName, args.notePath)

      const parts: string[] = []
      if (result.frontmatter) {
        parts.push(
          `**Frontmatter:**\n${Object.entries(result.frontmatter)
            .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
            .join('\n')}`
        )
      }
      parts.push(result.content)

      return { content: [{ type: 'text', text: parts.join('\n\n') }] }
    })
  )

  // =========================================================================
  // 2. Write a note
  // =========================================================================
  s.tool(
    'prjct_obsidian_write',
    'Create or update a note in the project Obsidian vault with optional frontmatter.',
    {
      projectPath: z.string().describe('Project directory path'),
      notePath: z
        .string()
        .describe(
          'Relative path within the project vault folder (e.g., "architecture/new-decision.md")'
        ),
      content: z.string().describe('Markdown content of the note (without frontmatter)'),
      frontmatter: z
        .record(z.unknown())
        .optional()
        .describe('YAML frontmatter as key-value object'),
    },
    safeMcpCall(
      'prjct_obsidian_write',
      async (args: {
        projectPath: string
        notePath: string
        content: string
        frontmatter?: Record<string, unknown>
      }) => {
        const { config, projectName } = await resolveObsidian(args.projectPath)
        await obsidianExporter.writeNote(
          config,
          projectName,
          args.notePath,
          args.content,
          args.frontmatter
        )
        return {
          content: [{ type: 'text', text: `Note written: ${args.notePath}` }],
        }
      }
    )
  )

  // =========================================================================
  // 3. Search notes
  // =========================================================================
  s.tool(
    'prjct_obsidian_search',
    'Search notes in the project Obsidian vault by text query. Returns ranked results with excerpts.',
    {
      projectPath: z.string().describe('Project directory path'),
      query: z.string().describe('Search query (multi-word supported)'),
      folder: z
        .string()
        .optional()
        .describe('Restrict to a folder (e.g., "architecture", "research")'),
      limit: z.number().optional().default(10).describe('Max results (default 10)'),
    },
    safeMcpCall(
      'prjct_obsidian_search',
      async (args: { projectPath: string; query: string; folder?: string; limit: number }) => {
        const { config, projectName } = await resolveObsidian(args.projectPath)
        const results = await obsidianExporter.searchNotes(config, projectName, args.query, {
          limit: args.limit,
          folder: args.folder,
        })

        if (results.length === 0) {
          return { content: [{ type: 'text', text: `No notes found for: "${args.query}"` }] }
        }

        const lines = results.map(
          (r) => `### ${r.title}\n\`${r.path}\` (score: ${r.score.toFixed(1)})\n> ${r.excerpt}`
        )
        return {
          content: [
            {
              type: 'text',
              text: `## Search: "${args.query}" (${results.length} results)\n\n${lines.join('\n\n')}`,
            },
          ],
        }
      }
    )
  )

  // =========================================================================
  // 4. List notes
  // =========================================================================
  s.tool(
    'prjct_obsidian_list',
    'List notes and folders in the project Obsidian vault.',
    {
      projectPath: z.string().describe('Project directory path'),
      folder: z
        .string()
        .optional()
        .describe('Subfolder to list (e.g., "architecture"). Omit for root.'),
    },
    safeMcpCall('prjct_obsidian_list', async (args: { projectPath: string; folder?: string }) => {
      const { config, projectName } = await resolveObsidian(args.projectPath)
      const entries = await obsidianExporter.listNotes(config, projectName, args.folder)

      if (entries.length === 0) {
        return {
          content: [{ type: 'text', text: `Empty: ${args.folder || 'vault root'}` }],
        }
      }

      const dirs = entries.filter((e) => e.isDir)
      const files = entries.filter((e) => !e.isDir)

      const lines: string[] = []
      if (dirs.length > 0) {
        lines.push(`**Folders (${dirs.length}):**\n${dirs.map((d) => `- ${d.name}/`).join('\n')}`)
      }
      if (files.length > 0) {
        lines.push(
          `**Notes (${files.length}):**\n${files.map((f) => `- ${f.name}${f.size ? ` (${(f.size / 1024).toFixed(1)}KB)` : ''}`).join('\n')}`
        )
      }

      return {
        content: [
          {
            type: 'text',
            text: `## ${args.folder || 'Vault Root'}\n\n${lines.join('\n\n')}`,
          },
        ],
      }
    })
  )

  // =========================================================================
  // 5. Export project data
  // =========================================================================
  s.tool(
    'prjct_obsidian_export',
    'Export all prjct data (board, queue, shipped, roadmap, daily) to Obsidian vault.',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_obsidian_export', async (args: { projectPath: string }) => {
      const { projectId, config, projectName } = await resolveObsidian(args.projectPath)
      const result = await obsidianExporter.exportAll(projectId, projectName, config)

      const lines = [
        `## Obsidian Export`,
        `Board: ${result.exported.board} tasks`,
        `Queue: ${result.exported.queue} items`,
        `Shipped: ${result.exported.shipped} items`,
        `Roadmap: ${result.exported.roadmap} features`,
        `Daily: ${result.exported.daily ? 'generated' : 'skipped'}`,
      ]
      if (result.errors.length > 0) {
        lines.push(`\nErrors:\n${result.errors.map((e) => `- ${e}`).join('\n')}`)
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] }
    })
  )

  // =========================================================================
  // 6. Vault stats
  // =========================================================================
  s.tool(
    'prjct_obsidian_stats',
    'Get statistics about the project Obsidian vault (note count, folders, size).',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_obsidian_stats', async (args: { projectPath: string }) => {
      const { config, projectName } = await resolveObsidian(args.projectPath)
      const stats = await obsidianExporter.getVaultStats(config, projectName)

      const folderLines = Object.entries(stats.folders)
        .sort(([, a], [, b]) => b - a)
        .map(([folder, count]) => `- ${folder}: ${count} notes`)

      return {
        content: [
          {
            type: 'text',
            text: [
              `## Vault Stats`,
              `Total notes: ${stats.totalNotes}`,
              `Total size: ${(stats.totalSize / 1024).toFixed(1)} KB`,
              `\n**By folder:**`,
              ...folderLines,
            ].join('\n'),
          },
        ],
      }
    })
  )

  // =========================================================================
  // 7. Vault status
  // =========================================================================
  s.tool(
    'prjct_obsidian_status',
    'Check Obsidian integration status for this project.',
    {
      projectPath: z.string().describe('Project directory path'),
    },
    safeMcpCall('prjct_obsidian_status', async (args: { projectPath: string }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const globalConfig = await configManager.readGlobalConfig(projectId)
      const config = globalConfig?.integrations?.obsidian

      if (!config) {
        return {
          content: [
            {
              type: 'text',
              text: 'Obsidian not configured. Run: prjct obsidian setup --vault-path /path/to/vault',
            },
          ],
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: [
              `## Obsidian Status`,
              `Vault: ${config.vaultPath}`,
              `Project folder: ${config.projectFolder || path.basename(args.projectPath)}`,
              `Auto-export: ${config.autoExport ? 'enabled' : 'disabled'}`,
            ].join('\n'),
          },
        ],
      }
    })
  )

  // =========================================================================
  // 8. Import data into vault
  // =========================================================================
  s.tool(
    'prjct_obsidian_import',
    'Import structured data (e.g., Linear issues, tasks) into the Obsidian vault as individual notes.',
    {
      projectPath: z.string().describe('Project directory path'),
      folder: z.string().describe('Target folder (e.g., "linear", "board", "research")'),
      notes: z
        .array(
          z.object({
            filename: z.string().describe('Note filename (e.g., "ENG-123.md")'),
            title: z.string().describe('Note title (H1)'),
            content: z.string().describe('Markdown body'),
            frontmatter: z.record(z.unknown()).optional().describe('YAML frontmatter fields'),
          })
        )
        .describe('Array of notes to import'),
    },
    safeMcpCall(
      'prjct_obsidian_import',
      async (args: {
        projectPath: string
        folder: string
        notes: Array<{
          filename: string
          title: string
          content: string
          frontmatter?: Record<string, unknown>
        }>
      }) => {
        const { config, projectName } = await resolveObsidian(args.projectPath)
        let imported = 0
        const errors: string[] = []

        for (const note of args.notes) {
          try {
            const notePath = `${args.folder}/${note.filename}`
            const body = `# ${note.title}\n\n${note.content}`
            await obsidianExporter.writeNote(config, projectName, notePath, body, note.frontmatter)
            imported++
          } catch (e) {
            errors.push(`${note.filename}: ${e instanceof Error ? e.message : String(e)}`)
          }
        }

        const text = [`## Import Complete`, `Imported: ${imported}/${args.notes.length} notes`]
        if (errors.length > 0) {
          text.push(`\nErrors:\n${errors.map((e) => `- ${e}`).join('\n')}`)
        }

        return { content: [{ type: 'text', text: text.join('\n') }] }
      }
    )
  )
}
